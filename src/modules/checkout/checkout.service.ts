import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CheckoutDraftRepository } from './repo/checkout-draft.repository';
import { CartRepository } from '../cart/repo/cart.repository';
import type { CheckoutDraft } from './schemas/checkout-draft.schema';
import { MelhorEnvioClient } from './providers/melhor-envio.client';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from '../products/products.service';

type PrintMode = 'public' | 'private';

// Status internos que usamos no pipeline (podem ser mais amplos do que o tipo do schema)
type MelhorEnvioStepStatus =
  | 'carted'
  | 'checked_out'
  | 'generated'
  | 'printed'
  | 'awaiting_balance'
  | 'failed';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly drafts: CheckoutDraftRepository,
    private readonly carts: CartRepository,
    private readonly me: MelhorEnvioClient,
    private readonly config: ConfigService,
    private readonly products: ProductsService,
  ) {}

  // ------------------------
  // Utilidades de totais
  // ------------------------
  private clampNonNegative(n: number) {
    return n < 0 ? 0 : n;
  }

  private sumItemDiscounts(cart: any) {
    return (cart.items ?? [])
      .flatMap((it: any) => it.discounts ?? [])
      .reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0);
  }

  private recalc(cart: any) {
    for (const it of cart.items ?? []) {
      const unit = Number(it.unitPrice) || 0;
      const qty = Math.max(1, Number(it.quantity) || 1);
      it.total = unit * qty;
    }

    const itemsSubtotal = (cart.items ?? []).reduce(
      (sum: number, it: any) => sum + (Number(it.total) || 0),
      0,
    );

    const itemDiscounts = this.sumItemDiscounts(cart);
    const couponDiscounts = 0; // engine de cupons do carrinho continua valendo
    const discountTotal = this.clampNonNegative(itemDiscounts + couponDiscounts);
    const shippingTotal = Number(cart.shipping?.amount) || 0;
    const taxTotal = Number(cart.taxTotal) || 0;
    const grandTotal = this.clampNonNegative(
      itemsSubtotal - discountTotal + shippingTotal + taxTotal,
    );

    Object.assign(cart, {
      itemsSubtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      grandTotal,
    });
    return cart;
  }

  private ttlMs() {
    const minutes = Number(this.config.get('CHECKOUT_DRAFT_TTL_MINUTES') || 30);
    return Math.max(5, minutes) * 60 * 1000;
  }

  // ------------------------
  // Preparação do draft
  // ------------------------
  async prepare(
    cartId: string,
    expectedVersion: number | null,
    idempotencyKey?: string,
  ): Promise<CheckoutDraft> {
    const cart = await this.carts.findById(String(cartId));
    if (!cart) throw new NotFoundException('cart_not_found');
    if (!cart.items?.length) throw new BadRequestException('empty_cart');

    const quantityBySku = new Map<string, number>();
    for (const item of cart.items) quantityBySku.set(item.sku, (quantityBySku.get(item.sku) ?? 0) + item.quantity);
    for (const [sku, quantity] of quantityBySku) {
      const product = await this.products.getPurchasableBySku(sku);
      if (!product.madeToOrder && quantity > product.stock) throw new BadRequestException('insufficient_stock');
      for (const item of cart.items.filter((line) => line.sku === sku)) item.unitPrice = this.products.priceForVariant(product, item.variant);
    }
    this.recalc(cart);

    if (idempotencyKey) {
      const existing = await this.drafts.findOpenByCartAndIdem(
        (cart as any)._id ?? (cart as any).id,
        idempotencyKey,
      );
      if (existing) {
        if (existing.totals.itemsSubtotal !== cart.itemsSubtotal) throw new ConflictException('stale_checkout_draft');
        return existing as any;
      }
    }

    const isME =
      cart.shipping?.provider === 'melhor-envio' || !!cart.shipping?.me;

    const draft = await this.drafts.create({
      id: randomUUID(),
      cartId: (cart as any)._id ?? (cart as any).id,
      customerId: (cart as any).userId,
      cartVersion: expectedVersion ?? cart.version,
      items: cart.items,
      coupons: cart.coupons ?? [],
      shipping: cart.shipping,
      shippingAddress: cart.shippingAddress,
      totals: {
        itemsSubtotal: cart.itemsSubtotal,
        discountTotal: cart.discountTotal,
        shippingTotal: cart.shippingTotal,
        taxTotal: cart.taxTotal,
        grandTotal: cart.grandTotal,
      },
      idempotencyKey,
      status: 'open',
      expiresAt: new Date(Date.now() + this.ttlMs()),
      // ✅ importante: mantenha o literal 'carted' como literal (as const) para casar com o tipo do schema
      integration: isME
        ? { provider: 'melhor-envio', melhorEnvio: { status: 'carted' as const } }
        : undefined,
    });

    return draft.toJSON() as any;
  }

  async getDraftForCart(cartId: string, id: string) {
    const draft = await this.drafts.findByIdForCart(id, cartId);
    if (!draft) throw new NotFoundException('draft_not_found');
    return draft as any;
  }

  async abandonAllForCart(cartId: string) {
    await this.drafts.abandonAllForCart(cartId);
  }

  // ------------------------
  // Helpers de integração ME
  // ------------------------
  private onlyDigits(v: string) {
    return String(v || '').replace(/\D/g, '');
  }

  private ensureShippingForME(cart: any) {
    const isME =
      cart.shipping?.provider === 'melhor-envio' || !!cart.shipping?.me;
    if (!isME) {
      throw new BadRequestException('shipping_not_selected_or_invalid_provider');
    }
    if (!cart.shipping?.me) {
      // Dados de ME (serviceId, volumes, options...) devem estar em cart.shipping.me
      throw new BadRequestException('shipping_me_payload_missing');
    }
  }

  private getSenderFromEnv() {
    const required = (k: string) => {
      const v = this.config.get<string>(k);
      if (!v) throw new BadRequestException(`env_missing:${k}`);
      return v;
    };

    const name = required('ORIGIN_NAME');
    const document = this.config.get<string>('ORIGIN_DOCUMENT'); // CPF (opcional se tiver CNPJ)
    const company_document = this.config.get<string>('ORIGIN_COMPANY_DOCUMENT'); // CNPJ (opcional)
    if (!document && !company_document) {
      throw new BadRequestException('origin_document_or_company_document_required');
    }

    const state_register = this.config.get<string>('ORIGIN_STATE_REGISTER') || undefined;

    const postal_code = this.onlyDigits(required('ORIGIN_POSTAL_CODE'));
    const address = required('ORIGIN_ADDRESS');
    const number = required('ORIGIN_NUMBER');
    const complement = this.config.get<string>('ORIGIN_COMPLEMENT') || undefined;
    const district = required('ORIGIN_DISTRICT');
    const city = required('ORIGIN_CITY');
    const state_abbr = required('ORIGIN_STATE_ABBR');

    const phone = this.config.get<string>('ORIGIN_PHONE') || undefined;
    const email = this.config.get<string>('ORIGIN_EMAIL') || undefined;

    return {
      name,
      document: document || undefined,
      company_document: company_document || undefined,
      state_register,
      postal_code,
      address,
      number,
      complement,
      district,
      city,
      state_abbr,
      phone,
      email,
    };
  }

  private validateRecipientFromCartAddress(addr: any) {
    if (!addr) throw new BadRequestException('shipping_address_missing');

    const postal_code = this.onlyDigits(addr.postalCode || addr.postal_code);
    const name = addr.name || addr.fullName;
    const phone = addr.phone || addr.phoneNumber;
    const email = addr.email;
    const address = addr.address || addr.street;
    const number = addr.number;
    const complement = addr.complement;
    const district = addr.district || addr.neighborhood;
    const city = addr.city;
    const state_abbr = addr.state_abbr || addr.state || addr.uf;
    const document = addr.document || addr.cpf;
    const company_document = addr.company_document || addr.cnpj;
    const state_register = addr.state_register;

    if (!postal_code) throw new BadRequestException('recipient_postal_code_required');
    if (!name) throw new BadRequestException('recipient_name_required');
    if (!address) throw new BadRequestException('recipient_address_required');
    if (!number) throw new BadRequestException('recipient_number_required');
    if (!district) throw new BadRequestException('recipient_district_required');
    if (!city) throw new BadRequestException('recipient_city_required');
    if (!state_abbr) throw new BadRequestException('recipient_state_abbr_required');
    if (!document && !company_document) {
      throw new BadRequestException('recipient_document_or_company_document_required');
    }

    return {
      name,
      document: document || undefined,
      company_document: company_document || undefined,
      state_register: state_register || undefined,
      postal_code,
      address,
      number,
      complement,
      district,
      city,
      state_abbr,
      phone,
      email,
    };
  }

  /**
   * Em produção, tokens do Melhor Envio devem ser por usuário (OAuth2).
   * Aqui mantemos um fallback por env (`ME_ACCESS_TOKEN`) para simplificar.
   */
  private getAccessTokenForUser(_userId?: string): string {
    const token = this.config.get<string>('ME_ACCESS_TOKEN');
    if (!token) {
      throw new BadRequestException('melhor_envio_access_token_not_configured_for_user');
    }
    return token;
  }

  private buildCartPayloadForME(cart: any) {
    const me = cart.shipping.me;
    const serviceId = Number(me.serviceId);
    if (!Number.isFinite(serviceId)) throw new BadRequestException('invalid_me_service_id');

    const from = this.getSenderFromEnv();
    const to = this.validateRecipientFromCartAddress(cart.shippingAddress);

    const options: any = {
      insurance_value: Number(me.options?.insurance_value || 0),
      receipt: !!me.options?.receipt,
      own_hand: !!me.options?.own_hand,
      non_commercial: !!me.options?.non_commercial,
      platform: me.options?.platform,
      tags: Array.isArray(me.options?.tags) ? me.options.tags : undefined,
    };

    if (!options.non_commercial) {
      const key = me.options?.invoice_key;
      if (!key) throw new BadRequestException('invoice_key_required');
      options.invoice = { key };
    }

    const payload: any = {
      service: serviceId,
      from,
      to,
      volumes: Array.isArray(me.volumes) && me.volumes.length ? me.volumes : undefined,
      options,
    };

    if (options.non_commercial) {
      const products = Array.isArray(me.products) ? me.products : [];
      if (products.length) payload.products = products;
    }

    if (me.agencyId) {
      const agencyNum = Number(me.agencyId);
      if (Number.isFinite(agencyNum)) payload.agency = agencyNum;
    }

    return payload;
  }

  private async patchIntegration(
    draftId: string,
    patch: Partial<{
      provider: 'melhor-envio';
      melhorEnvio: {
        status?: MelhorEnvioStepStatus;
        orders?: string[];
        cartPayload?: any;
        lastResponse?: any;
        print?: { mode: PrintMode; url: string };
        previewUrl?: string;
      };
    }>,
  ) {
    await this.drafts.patchById(draftId, {
      integration: {
        provider: 'melhor-envio',
        melhorEnvio: {
          ...(patch.melhorEnvio || {}),
        },
      },
    } as any);
  }

  // ------------------------
  // Execução do fluxo ME
  // ------------------------
  /**
   * Executa o pipeline do Melhor Envio:
   * 1) addToCart → 2) checkout → 3) generate → 4) print
   * É idempotente e retoma de onde parou.
   */
  async place(
    cartId: string,
    draftId: string,
    printMode: PrintMode,
    idempotencyKey?: string,
  ) {
    const draft = await this.drafts.findByIdForCart(draftId, cartId);
    if (!draft) throw new NotFoundException('draft_not_found');
    if (draft.status !== 'open') {
      if (draft.status === 'completed') return draft;
      throw new ConflictException('draft_not_open');
    }

    const cart = await this.carts.findById(String(cartId));
    if (!cart) throw new NotFoundException('cart_not_found');
    if (!cart.items?.length) throw new BadRequestException('empty_cart');

    this.recalc(cart);
    this.ensureShippingForME(cart);

    const token = this.getAccessTokenForUser((cart as any).userId);

    // Estado atual (se já houve tentativa anterior)
    const integration = (draft as any).integration?.melhorEnvio || {};
    let status: MelhorEnvioStepStatus | undefined = integration.status;
    let orderIds: string[] = Array.isArray(integration.orders) ? [...integration.orders] : [];

    // 1) ADD TO CART (se ainda não carted ou sem orders)
    if (!status || !orderIds.length || status === 'failed' || status === 'awaiting_balance') {
      const cartPayload = this.buildCartPayloadForME(cart);
      const addResp = await this.me.addToCart(cartPayload, token);
      orderIds = Array.isArray(addResp)
        ? addResp.map((o: any) => o?.id || o?.order_id || o).filter(Boolean)
        : [addResp?.id || addResp?.order_id].filter(Boolean);

      if (!orderIds.length) {
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'failed', lastResponse: addResp },
        });
        throw new BadRequestException('failed_to_add_to_melhor_envio_cart');
      }

      await this.patchIntegration(draftId, {
        melhorEnvio: {
          status: 'carted',
          orders: orderIds,
          cartPayload,
          lastResponse: addResp,
        },
      });
      status = 'carted';
    }

    // 2) CHECKOUT
    if (status === 'carted') {
      try {
        const checkoutResp = await this.me.checkout(orderIds, token);
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'checked_out', orders: orderIds, lastResponse: checkoutResp },
        });
        status = 'checked_out';
      } catch (err: any) {
        // Tratar saldo insuficiente (422) ou outros
        const code = Number(err?.status || err?.response?.status);
        if (code === 422) {
          await this.patchIntegration(draftId, {
            melhorEnvio: {
              status: 'awaiting_balance',
              orders: orderIds,
              lastResponse: err?.response?.data ?? err,
            },
          });
          throw new ConflictException('melhor_envio_insufficient_balance');
        }
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'failed', orders: orderIds, lastResponse: err?.response?.data ?? err },
        });
        throw new InternalServerErrorException('melhor_envio_checkout_failed');
      }
    }

    // 3) GENERATE
    if (status === 'checked_out') {
      try {
        // ✅ Corrigido: generate aceita apenas (orders, token)
        const generateResp = await this.me.generate(orderIds, token);
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'generated', orders: orderIds, lastResponse: generateResp },
        });
        status = 'generated';
      } catch (err: any) {
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'failed', orders: orderIds, lastResponse: err?.response?.data ?? err },
        });
        throw new InternalServerErrorException('melhor_envio_generate_failed');
      }
    }

    // 4) PRINT
    let printUrl: string | undefined =
      (integration?.print?.url as string | undefined) ?? undefined;

    if (status === 'generated' && !printUrl) {
      try {
        const printResp = await this.me.print(orderIds, printMode, token);
        printUrl =
          printResp?.url ||
          printResp?.link ||
          (Array.isArray(printResp?.links) ? printResp.links[0] : undefined);

        await this.patchIntegration(draftId, {
          melhorEnvio: {
            status: 'printed',
            orders: orderIds,
            lastResponse: printResp,
            print: printUrl ? { mode: printMode, url: printUrl } : undefined,
          },
        });
        status = 'printed';
      } catch (err: any) {
        await this.patchIntegration(draftId, {
          melhorEnvio: { status: 'failed', orders: orderIds, lastResponse: err?.response?.data ?? err },
        });
        throw new InternalServerErrorException('melhor_envio_print_failed');
      }
    }

    await this.drafts.markCompleted(draftId);

    return {
      draftId,
      orders: orderIds,
      print: printUrl ? { mode: printMode, url: printUrl } : undefined,
      totals: (draft as any).totals,
      shipping: (draft as any).shipping,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { CartRepository } from './repo/cart.repository';
import { AddItemDto, UpdateItemDto, ShippingSelectDto } from './dto/cart.dto';
import { Cart } from './schemas/cart.schema';

import { ShippingService } from '../shipping/shipping.service';
import { CalculateShippingDto } from '../shipping/dto/calculate-shipping.dto';
import { CheckoutService } from '../checkout/checkout.service';
import { ProductsService } from '../products/products.service';
import { CouponsService } from '../coupons/coupons.service';

type QuoteCache = {
  postalCode: string; // 8 dígitos
  quotes: Array<{
    serviceCode: string; // id serviço ME
    label: string;
    amount: number; // centavos
    days: number;
    eta?: string;
    isFree?: boolean;
    source?: string;
    me?: {
      companyId?: string;
      requiresAgency?: boolean;
    };
  }>;
};

@Injectable()
export class CartService {
  private readonly quoteCacheTtlSec = 600;

  constructor(
    private readonly repo: CartRepository,
    private readonly shipping: ShippingService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(forwardRef(() => CheckoutService)) private readonly checkout: CheckoutService,
    private readonly products: ProductsService,
    private readonly coupons: CouponsService,
  ) {}

  private toCents(brl: number) {
    return Math.round(Number(brl) * 100);
  }

  private clampNonNegative(n: number) {
    return n < 0 ? 0 : n;
  }

  private sumItemDiscounts(cart: Cart) {
    return (cart.items ?? [])
      .flatMap((it: any) => it.discounts ?? [])
      .reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0);
  }

  private onlyDigits(v: string) {
    return String(v || '').replace(/\D/g, '');
  }

  private async recalc(cart: Cart): Promise<Cart> {
    for (const it of cart.items ?? []) {
      const unit = Number(it.unitPrice) || 0; // centavos
      const qty = Math.max(1, Number(it.quantity) || 1);
      it.total = unit * qty; // centavos
    }

    const itemsSubtotal = (cart.items ?? []).reduce(
      (sum: number, it: any) => sum + (Number(it.total) || 0),
      0,
    );

    const itemDiscounts = this.sumItemDiscounts(cart);
    const couponDiscounts = await this.coupons.cartDiscount({ ...cart, itemsSubtotal });
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

  private async mustGet(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException('cart_not_found');
    return c as Cart;
  }

  private assertActive(c: Cart) {
    if (c.status !== 'active') {
      throw new BadRequestException('cart_not_active');
    }
  }

  private packFromCart(c: Cart) {
    const items = c.items ?? [];
    const weightKg =
      items.reduce(
        (sum, it: any) =>
          sum + (Number(it.weightGrams ?? 300) / 1000) * (Number(it.quantity) || 1),
        0,
      ) || 1;

    const lengthCm = 25;
    const widthCm = 20;
    const heightCm = 15;

    const declaredValueBRL = Math.max(
      0,
      (Number(c.itemsSubtotal) - Number(c.discountTotal)) / 100,
    );

    return { weightKg, lengthCm, widthCm, heightCm, declaredValueBRL };
  }

  private buildUpdatePatch(c: Cart): Partial<Cart> {
    return {
      status: c.status,
      items: c.items as any,
      coupons: c.coupons as any,
      shipping: c.shipping as any,
      shippingAddress: c.shippingAddress as any,
      shippingQuotes: c.shippingQuotes,
      itemsSubtotal: c.itemsSubtotal,
      discountTotal: c.discountTotal,
      shippingTotal: c.shippingTotal,
      taxTotal: c.taxTotal,
      grandTotal: c.grandTotal,
      currency: c.currency,
      locale: c.locale,
    };
  }

  private async clearShippingCacheAndSelection(cartId: string, cart?: Cart) {
    await this.cache.del(`cart:ship:${cartId}`);
    if (cart) {
      cart.shippingQuotes = undefined;
      cart.shippingTotal = 0;
      cart.grandTotal = this.clampNonNegative(cart.itemsSubtotal - cart.discountTotal + cart.taxTotal);
    }
    if (cart && cart.shipping) {
      cart.shipping = undefined as any;
    }
  }

  private buildProductsForME(cart: Cart) {
    return (cart.items ?? []).map((it: any) => ({
      name: it.name || it.sku,
      quantity: Number(it.quantity) || 1,
      unitary_value: Number(it.unitPrice || 0) / 100, // centavos -> BRL
      weight: it.weightGrams ? Number(it.weightGrams) / 1000 : undefined,
    }));
  }

  private buildVolumesForME(cart: Cart) {
    const items = cart.items ?? [];
    const totalWeightKg =
      items.reduce((s, it: any) => s + ((Number(it.weightGrams ?? 300) / 1000) * (Number(it.quantity) || 1)), 0) || 1;

    const lengthCm = 25, widthCm = 20, heightCm = 15;

    return [{
      height: heightCm,
      width:  widthCm,
      length: lengthCm,
      weight: Number(totalWeightKg.toFixed(3)),
    }];
  }

  private computeInsuranceValueBRL(cart: Cart) {
    return Math.max(0, (Number(cart.itemsSubtotal) - Number(cart.discountTotal)) / 100);
  }

  async createCart(userId?: string): Promise<Cart> {
    const cart = await this.repo.create({
      userId,
      status: 'active',
      currency: 'BRL',
      locale: 'pt-BR',
      items: [],
      coupons: [],
      version: 1,
      itemsSubtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
    });
    return cart.toJSON() as any;
  }

  async getCart(id: string): Promise<Cart> {
    const c = await this.mustGet(id);
    return c;
  }

  async addItem(cartId: string, expectedVersion: number | null, dto: AddItemDto): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    const product = await this.products.getPurchasableBySku(dto.sku);
    const quantityInCart = c.items.filter((it) => it.sku === product.sku).reduce((sum, it) => sum + it.quantity, 0);
    if (!product.madeToOrder && quantityInCart + dto.quantity > product.stock) throw new BadRequestException('insufficient_stock');

    const item = {
      id: randomUUID(),
      productId: product.id,
      name: product.name,
      image: product.images?.[0],
      sku: dto.sku,
      quantity: dto.quantity,
      unitPrice: this.products.priceForVariant(product, dto.variant),
      listPrice: undefined,
      variant: dto.variant,
      discounts: [],
      weightGrams: dto?.weightGrams ?? undefined,
      dimensions: dto?.dimensions ?? undefined,
      total: 0,
    };

    const same = c.items.find(
      (it) =>
        it.sku === item.sku &&
        JSON.stringify(it.variant ?? {}) === JSON.stringify(item.variant ?? {}),
    );
    if (same) {
      same.quantity += item.quantity;
      same.unitPrice = item.unitPrice;
      same.total = same.quantity * same.unitPrice;
    } else {
      c.items.push(item as any);
    }

    await this.recalc(c);
    await this.clearShippingCacheAndSelection(cartId, c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async updateItem(
    cartId: string,
    expectedVersion: number | null,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    const it = c.items.find((i) => i.id === itemId);
    if (!it) throw new NotFoundException('item_not_found');

    if (dto.quantity !== undefined || dto.variant !== undefined) {
      if (dto.quantity !== undefined && dto.quantity < 1) throw new BadRequestException('min_quantity_1');
      const product = await this.products.getPurchasableBySku(it.sku);
      const otherQuantity = c.items.filter((line) => line.sku === it.sku && line.id !== it.id).reduce((sum, line) => sum + line.quantity, 0);
      if (!product.madeToOrder && otherQuantity + (dto.quantity ?? it.quantity) > product.stock) throw new BadRequestException('insufficient_stock');
      it.unitPrice = this.products.priceForVariant(product, dto.variant ?? it.variant);
      if (dto.quantity !== undefined) it.quantity = dto.quantity;
    }
    if (dto.variant) {
      it.variant = dto.variant;
    }
    it.total = it.quantity * it.unitPrice;

    await this.recalc(c);
    await this.clearShippingCacheAndSelection(cartId, c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async removeItem(
    cartId: string,
    expectedVersion: number | null,
    itemId: string,
  ): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    c.items = c.items.filter((i) => i.id !== itemId) as any;

    await this.recalc(c);
    await this.clearShippingCacheAndSelection(cartId, c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async applyCoupon(
    cartId: string,
    expectedVersion: number | null,
    code: string,
  ): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    c.coupons = [code.trim().toUpperCase()];

    await this.recalc(c);
    await this.clearShippingCacheAndSelection(cartId, c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async removeCoupon(
    cartId: string,
    expectedVersion: number | null,
    code: string,
  ): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    c.coupons = c.coupons.filter((x) => x !== code);

    await this.recalc(c);
    await this.clearShippingCacheAndSelection(cartId, c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async quoteShipping(cartId: string, address: Record<string, any>) {
    const c = await this.mustGet(cartId);
    if (!c.items?.length) throw new BadRequestException('empty_cart');

    const postal = String(address?.postalCode ?? '').trim();
    if (!postal) throw new BadRequestException('postalCode_required');

    const { normalized } = await this.shipping.validatePostalCode(postal);
    const toDigits = this.onlyDigits(normalized);

    const pkg = this.packFromCart(c);

    const dto: CalculateShippingDto = {
      destination: { postalCode: toDigits },
      packages: [
        {
          weightKg: pkg.weightKg,
          widthCm: pkg.widthCm,
          heightCm: pkg.heightCm,
          lengthCm: pkg.lengthCm,
          declaredValue: pkg.declaredValueBRL,
        },
      ],
      cartTotal: Math.max(0, (c.itemsSubtotal - c.discountTotal) / 100),
      preferCheapest: true,
    } as any;

    const result = await this.shipping.quote(dto);

    const quotes = (result?.quotes ?? []).map((q: any) => {
      const companyId = q?.company?.code ? String(q.company.code) : undefined;
      const requiresAgency = companyId === '2'; // JadLog (id=2); ajuste se necessário
      return {
        serviceCode: String(q.id),
        label: `${q.name} • ${q.company?.name ?? ''}`.trim(),
        amount: this.toCents(q.priceBRL),
        days: Number(q.deliveryDays) || 0,
        eta: q.etaDate,
        isFree: !!q.isFree,
        source: result?.source,
        me: { companyId, requiresAgency },
      };
    });

    const payload: QuoteCache = { postalCode: toDigits, quotes };
    c.shippingQuotes = { ...payload, expiresAt: Date.now() + this.quoteCacheTtlSec * 1000 };
    await this.cache.set(`cart:ship:${cartId}`, payload, this.quoteCacheTtlSec);

    // Persistir endereço normalizado (sem "fixar" seleção)
    c.shippingAddress = { ...(c.shippingAddress ?? {}), ...(address ?? {}), postalCode: toDigits };
    await this.repo.updateByIdWithVersion(cartId, c.version, this.buildUpdatePatch(c));

    return payload;
  }

  async selectShipping(
    cartId: string,
    expectedVersion: number | null,
    dto: ShippingSelectDto,
  ): Promise<Cart> {
    const c = await this.mustGet(cartId);
    this.assertActive(c);

    const serviceCode = String(dto.serviceCode);
    const cached = c.shippingQuotes
      ? (c.shippingQuotes.expiresAt > Date.now() ? c.shippingQuotes : null)
      : (await this.cache.get(`cart:ship:${cartId}`)) as QuoteCache | null;
    if (!cached) throw new BadRequestException('shipping_quotes_expired');

    const sel = cached.quotes.find((q) => String(q.serviceCode) === serviceCode);
    if (!sel) throw new BadRequestException('invalid_shipping_service');

    const nonCommercial = !!dto.nonCommercial;
    const invoiceKey = String(dto.invoiceKey || '').trim();
    if (sel.source !== 'demo' && !nonCommercial && !invoiceKey) {
      throw new BadRequestException('invoiceKey_required_when_commercial');
    }
    const agencyId = dto.agencyId ? String(dto.agencyId) : undefined;
    if (sel.source !== 'demo' && sel.me?.requiresAgency && !agencyId) {
      throw new BadRequestException('agency_required_for_selected_service');
    }

    const insuranceValue = this.computeInsuranceValueBRL(c);
    const volumes = this.buildVolumesForME(c);
    const products = this.buildProductsForME(c);
    const fromPostal = this.onlyDigits(process.env.ORIGIN_POSTAL_CODE || '72850180');
    const toPostal = cached.postalCode;

    c.shipping = {
      serviceCode: sel.serviceCode,
      label: sel.label,
      amount: sel.amount,
      days: sel.days,
      eta: sel.eta,
      isFree: sel.isFree,
      provider: 'melhor-envio',
      me: {
        serviceId: sel.serviceCode,
        companyId: sel.me?.companyId,
        agencyId,
        fromPostal,
        toPostal,
        options: {
          insurance_value: insuranceValue,
          receipt: !!dto.receipt,
          own_hand: !!dto.ownHand,
          non_commercial: nonCommercial,
          invoice_key: invoiceKey || undefined,
          platform: dto.platform || process.env.APP_NAME || 'MyStore',
          tags: Array.isArray(dto.tags) ? dto.tags.map(t => ({ tag: String(t.tag), url: t.url })) : undefined,
        },
        volumes,
        products, // usado quando non_commercial = true
      },
    };

    // Atualiza/normaliza shippingAddress (mantém dados do usuário)
    c.shippingAddress = {
      ...(c.shippingAddress ?? {}),
      postalCode: toPostal,
    };

    await this.recalc(c);

    const updated = await this.repo.updateByIdWithVersion(
      cartId,
      expectedVersion ?? c.version,
      this.buildUpdatePatch(c),
    );
    if (!updated) throw new ConflictException('version_mismatch');

    await this.checkout.abandonAllForCart(cartId);

    return updated as any;
  }

  async prepareCheckout(cartId: string, expectedVersion: number | null) {
    const c = await this.mustGet(cartId);
    this.assertActive(c);
    if (!c.items?.length) throw new BadRequestException('empty_cart');

    await this.recalc(c);
    const draft = await this.checkout.prepare(cartId, expectedVersion ?? c.version, /*idempotencyKey*/ undefined);
    return { orderDraftId: draft.id, cart: c };
  }

}

import {
  Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsRepository } from './repo/payments.repository';
import { AsaasProvider } from './providers/asaas.provider';
import { BillingType } from './enums/billing-type.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { CheckoutService } from '../checkout/checkout.service';
import { OrderStatus } from '../orders/enums/order-status.enum';

const toCents = (brl: number) => Math.max(0, Math.round(Number(brl || 0) * 100));

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly webhookSecret?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly repo: PaymentsRepository,
    private readonly asaas: AsaasProvider,
    private readonly checkout: CheckoutService,
  ) {
    this.webhookSecret = this.config.get<string>('ASAAS_WEBHOOK_SECRET');
  }

  listAdmin(page = 1, pageSize = 20, filter?: any) { return this.repo.listAdmin(page, pageSize, filter); }
  listByOrder(orderId: string) { return this.repo.listByOrder(orderId); }
  getById(id: string) { return this.repo.findById(id); }

  private assertDemo() {
    if (this.config.get('COMMERCE_MODE') !== 'demo' || this.config.get('MONGODB_DB') !== 'penrose_demo') {
      throw new ForbiddenException('Pagamento demonstrativo disponível apenas no ambiente isolado. Nenhuma cobrança foi criada.');
    }
  }

  async getOwnedPayment(id: string, customerId: string, role?: string) {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    const order = await this.orders.getById(payment.orderId);
    if (!order || (role !== 'admin' && order.customerId !== customerId)) throw new ForbiddenException();
    return payment;
  }

  async createDemoCheckout(dto: CreatePaymentDto, customerId: string, cartId?: string) {
    this.assertDemo();
    if (!cartId || !dto.draftId) throw new BadRequestException('Prepare o checkout antes de continuar.');
    const draft = await this.checkout.getDraftForCart(cartId, dto.draftId);
    let order = await this.orders.findByCheckoutDraftId(draft.id);
    if (order && order.customerId !== customerId) throw new ForbiddenException();
    if (!order) {
      await this.checkout.validateForPayment(cartId, draft);
      order = await this.orders.createOrder({
        customerId,
        items: draft.items.map((item: any) => ({ productId: item.productId, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, size: item.variant?.size })),
        subtotal: draft.totals.itemsSubtotal, shippingTotal: draft.totals.shippingTotal,
        discountTotal: draft.totals.discountTotal, grandTotal: draft.totals.grandTotal,
        couponCode: draft.coupons[0], notes: 'DEMONSTRAÇÃO — sem cobrança e sem envio real.',
        shipping: { ...draft.shipping, provider: 'DEMO' }, shippingAddress: draft.shippingAddress,
      } as any, draft.id);
    }
    if (order.customerId !== customerId) throw new ForbiddenException();
    return this.repo.getOrCreateDemo({
      id: order.id, orderId: order.id, billingType: dto.billingType,
      provider: 'DEMO', status: PaymentStatus.PENDING, amount: order.grandTotal,
      statusHistory: [{ status: PaymentStatus.PENDING, at: new Date() }],
    });
  }

  async resolveDemo(id: string, outcome: string, customerId: string, role?: string) {
    this.assertDemo();
    const payment = await this.getOwnedPayment(id, customerId, role);
    if (payment.provider !== 'DEMO') throw new ForbiddenException();
    const status = outcome === 'approve' ? PaymentStatus.CONFIRMED : outcome === 'decline' ? PaymentStatus.FAILED : null;
    if (!status) throw new BadRequestException('Invalid demo outcome');
    if (payment.status !== PaymentStatus.PENDING && payment.status !== status) throw new ForbiddenException('Payment already resolved');
    await this.orders.updateStatus(payment.orderId, status === PaymentStatus.CONFIRMED ? OrderStatus.PAID : OrderStatus.CANCELED);
    return payment.status === status ? payment : this.repo.updateStatus(id, status);
  }

  private defaultDueDateISO(dto: CreatePaymentDto) {
    if (dto.dueDateIso) return dto.dueDateIso;
    const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  async createPayment(dto: CreatePaymentDto) {
    if (!dto.cartItems?.length) throw new BadRequestException('Cart is empty');
    if (!Number.isFinite(dto.totalAmount) || dto.totalAmount <= 0) throw new BadRequestException('Total amount must be greater than 0');

    const orderItems = dto.cartItems.map((i: any) => ({
      ...i,
      unitPrice: toCents(Number(i.unitPrice)), // agora em centavos
    }));

    const subtotalCents = orderItems.reduce(
      (s: number, i: any) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      0,
    );

    const shippingCents = toCents(
      Number((dto as any).selectedShipping?.priceBRL ?? (dto as any).selectedShipping?.price ?? 0),
    );

    const computedGrandCents = subtotalCents + shippingCents;

    const clientGrandCents =
      dto.totalAmount !== undefined ? toCents(Number(dto.totalAmount)) : computedGrandCents;

    if (Math.abs(computedGrandCents - clientGrandCents) > 1) {
      this.logger.warn(
        `Grand total mismatch (client vs server): client=${clientGrandCents} computed=${computedGrandCents}`,
      );
    }

    const grandTotalCents = computedGrandCents;
    if (grandTotalCents <= 0) throw new BadRequestException('Total amount must be greater than 0');

    const order = await this.orders.createOrder({
      customerId: dto.customerData?.id || crypto.randomUUID(),
      items: orderItems,               // <<< itens em centavos
      subtotal: subtotalCents,
      shippingTotal: shippingCents,
      discountTotal: 0,
      grandTotal: grandTotalCents,
      couponCode: (dto as any)?.customerData?.couponCode || undefined,
      notes: undefined,
    } as any);

    const paymentId = crypto.randomUUID();
    const created = await this.repo.create({
      id: paymentId,
      orderId: order.id,
      billingType: dto.billingType,
      status: PaymentStatus.PENDING,
      amount: grandTotalCents,
      provider: 'ASAAS',
      createdAt: new Date(),
      updatedAt: new Date(),
      statusHistory: [{ status: PaymentStatus.PENDING, at: new Date() }],
    } as any);

    const idempotencyKey =
      dto.idempotencyKey ?? `${order.id}:${dto.billingType}:${grandTotalCents}`;

    const customerId = await this.asaas.ensureCustomer({
      name: dto.customerData?.name || dto.customerData?.nome,
      email: dto.customerData?.email,
      phone: dto.customerData?.phone || dto.customerData?.telefone,
      mobilePhone: dto.customerData?.mobilePhone || dto.customerData?.telefone,
      cpfCnpj: dto.customerData?.cpfCnpj || dto.customerData?.cpf,
      postalCode: dto.customerData?.postalCode || dto.customerData?.cep,
      address: dto.customerData?.address || dto.customerData?.endereco,
      addressNumber: dto.customerData?.addressNumber || dto.customerData?.numero,
      complement: dto.customerData?.complemento,
      province: dto.customerData?.bairro,
      city: dto.customerData?.cidade,
      state: dto.customerData?.estado,
    }).catch(async () => {
      await this.repo.updateStatus(paymentId, PaymentStatus.FAILED);
      throw new BadRequestException('Não foi possível iniciar o pagamento. Nenhuma confirmação foi emitida.');
    });

    const grandTotalBRL = Number((grandTotalCents / 100).toFixed(2));

    const common: any = {
      customer: customerId,
      billingType: dto.billingType,
      description: `Order ${order.orderNumber}`,
      externalReference: order.id,
    };

    if (dto.installmentCount && dto.installmentCount >= 2) {
      common.installmentCount = dto.installmentCount;
      if (dto.installmentValue) common.installmentValue = Number(dto.installmentValue); // BRL
      else if (dto.totalValue)   common.totalValue = Number(dto.totalValue);           // BRL
      else                       common.totalValue = grandTotalBRL;
    } else {
      common.value = grandTotalBRL; // BRL
    }

    if (dto.discount) common.discount = dto.discount;
    if (dto.interest) common.interest = dto.interest;
    if (dto.fine)     common.fine = dto.fine;

    if (dto.callback?.successUrl) {
      common.callback = {
        successUrl: dto.callback.successUrl,
        ...(typeof dto.callback.autoRedirect === 'boolean'
          ? { autoRedirect: dto.callback.autoRedirect }
          : {}),
      };
    }

    if ([BillingType.BOLETO, BillingType.PIX].includes(dto.billingType)) {
      common.dueDate = this.defaultDueDateISO(dto);
    }

    if (dto.billingType === BillingType.CREDIT_CARD) {
      if (dto.creditCardToken) {
        common.creditCardToken = dto.creditCardToken;
      } else if (dto.creditCard && dto.creditCardHolderInfo) {
        common.creditCard = dto.creditCard;
        common.creditCardHolderInfo = dto.creditCardHolderInfo;
      }
      if (dto.remoteIp) common.remoteIp = dto.remoteIp;
    }

    try {
      const res = await this.asaas.createPayment({ payload: common, idempotencyKey });

      const patch: any = {
        providerPaymentId: res.id,
      };

      if (dto.billingType === BillingType.PIX) {
        patch.pixPayload = res.pixQrCode?.payload;
      }

      if (dto.billingType === BillingType.BOLETO) {
        patch.boletoUrl = res.bankSlipUrl || res.invoiceUrl || undefined;

        const idf = await this.asaas.getIdentificationField(res.id).catch(() => null);
        if (idf?.identificationField) patch.identificatorField = idf.identificationField;
        else this.logger.warn(`Could not fetch boleto identification field: ${res.id}`);
      }

      if (dto.billingType === BillingType.CREDIT_CARD) {
        const map: Record<string, PaymentStatus> = {
          CONFIRMED: PaymentStatus.CONFIRMED,
          AUTHORIZED: PaymentStatus.AUTHORIZED,
          PENDING:    PaymentStatus.PENDING,
        };
        if (res.status && map[res.status]) patch.status = map[res.status];

        if (!dto.creditCard && !dto.creditCardToken && res.invoiceUrl) {
          patch.boletoUrl = res.invoiceUrl;
        }
      }

      const finalStatus = patch.status ?? PaymentStatus.PENDING;
      const updated = await this.repo.updateStatus(paymentId, finalStatus, patch);

      if (finalStatus === PaymentStatus.CONFIRMED) {
        await this.orders.updateStatus(order.id, 'paid' as any);
      }

      return updated!;
    } catch (err) {
      this.logger.error('Asaas createPayment failed', err as any);
      await this.repo.updateStatus(paymentId, PaymentStatus.FAILED);
      throw new BadRequestException('Falha ao criar pagamento. Tente novamente.');
    }
  }

  async cancelPayment(id: string) {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    if ([PaymentStatus.CONFIRMED, PaymentStatus.REFUNDED].includes(p.status)) {
      throw new ForbiddenException('Cannot cancel a confirmed/refunded payment');
    }
    const upd = await this.repo.updateStatus(id, PaymentStatus.CANCELED);
    return { message: 'Payment canceled', payment: upd };
  }

  async refundPayment(id: string) {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== PaymentStatus.CONFIRMED) {
      throw new ForbiddenException('Only confirmed payments can be refunded');
    }
    const upd = await this.repo.updateStatus(id, PaymentStatus.REFUNDED);
    await this.orders.refundOrder(p.orderId);
    return { message: 'Payment refunded', payment: upd };
  }

  verifyWebhookSignature(rawBody: string, signature?: string) {
    if (!this.webhookSecret || this.config.get('COMMERCE_MODE') === 'demo') return false;
    if (!signature) return false;
    const h = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return h === signature;
  }

  async handleWebhook(rawBody: string, payload: { providerPaymentId: string; status: string; orderId?: string; signature?: string; }) {
    if (!this.verifyWebhookSignature(rawBody, payload.signature)) {
      throw new ForbiddenException('Invalid signature');
    }
    const payment = await this.repo.findByProviderPaymentId(payload.providerPaymentId);
    if (!payment) throw new NotFoundException('Payment not found');

    const map: Record<string, PaymentStatus> = {
      CONFIRMED:       PaymentStatus.CONFIRMED,
      RECEIVED:        PaymentStatus.CONFIRMED,
      RECEIVED_IN_CASH:PaymentStatus.CONFIRMED,
      PENDING:         PaymentStatus.PENDING,
      AUTHORIZED:      PaymentStatus.AUTHORIZED,
      CANCELED:        PaymentStatus.CANCELED,
      CHARGEBACK:      PaymentStatus.REFUNDED,
      DISPUTE_LOST:    PaymentStatus.REFUNDED,
      REFUNDED:        PaymentStatus.REFUNDED,
      FAILED:          PaymentStatus.FAILED,
      OVERDUE:         PaymentStatus.PENDING,
    };
    const newStatus = map[payload.status] ?? PaymentStatus.PENDING;

    const updated = await this.repo.updateStatus(payment.id, newStatus);
    if (!updated) throw new InternalServerErrorException('Failed to update payment');

    if (newStatus === PaymentStatus.CONFIRMED) {
      await this.orders.updateStatus(payment.orderId, 'paid' as any);
    } else if (newStatus === PaymentStatus.CANCELED) {
      await this.orders.cancelOrder(payment.orderId);
    } else if (newStatus === PaymentStatus.REFUNDED) {
      await this.orders.refundOrder(payment.orderId);
    }

    return { ok: true };
  }
}

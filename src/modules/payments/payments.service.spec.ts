import { Test } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './repo/payments.repository';
import { OrdersService } from '../orders/orders.service';
import { AsaasProvider } from './providers/asaas.provider';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingType } from './enums/billing-type.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import * as crypto from 'crypto';

describe('PaymentsService', () => {
  let service: PaymentsService;

  // Mocks
  const repo = {
    listAdmin: jest.fn(),
    listByOrder: jest.fn(),
    findById: jest.fn(),
    findByProviderPaymentId: jest.fn(),
    create: jest.fn(async (doc: any) => ({ toJSON: () => doc })),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<PaymentsRepository>;

  const orders = {
    createOrder: jest.fn(async (o: any) => ({
      ...o,
      id: 'order-uuid',
      orderNumber: 42,
    })),
    updateStatus: jest.fn(),
    cancelOrder: jest.fn(),
    refundOrder: jest.fn(),
  } as unknown as jest.Mocked<OrdersService>;

  const asaas = {
    ensureCustomer: jest.fn(),
    createPayment: jest.fn(),
  } as unknown as jest.Mocked<AsaasProvider>;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ASAAS_WEBHOOK_SECRET') return 'supersecret';
      return undefined;
    }),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: repo },
        { provide: OrdersService, useValue: orders },
        { provide: AsaasProvider, useValue: asaas },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = mod.get(PaymentsService);
  });

  // ---------- createPayment

  it('createPayment (PIX): creates order, persists pending payment, calls Asaas and returns updated payment with pix payload', async () => {
    asaas.ensureCustomer = jest.fn().mockResolvedValue('cust_123');
    asaas.createPayment = jest.fn().mockResolvedValue({
      id: 'pay_asaas_1',
      status: 'PENDING',
      pixQrCode: { payload: '000201PIX...' },
    });
    repo.updateStatus = jest.fn().mockResolvedValue({
      id: 'payment-uuid',
      orderId: 'order-uuid',
      status: PaymentStatus.PENDING,
      providerPaymentId: 'pay_asaas_1',
      pixPayload: '000201PIX...',
    });

    const out = await service.createPayment({
      cartItems: [{ productId: 'p1', name: 'Prod 1', quantity: 2, unitPrice: 10 }],
      totalAmount: 20,
      billingType: BillingType.PIX,
      customerData: { id: 'cust_local_1', email: 'contato@example.com', name: 'John' },
    });

    expect(orders.createOrder).toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalled();
    expect(asaas.ensureCustomer).toHaveBeenCalled();
    expect(asaas.createPayment).toHaveBeenCalled();
    expect(repo.updateStatus).toHaveBeenCalledWith(expect.any(String), PaymentStatus.PENDING, expect.objectContaining({
      providerPaymentId: 'pay_asaas_1',
      pixPayload: '000201PIX...',
    }));
    expect(out.providerPaymentId).toBe('pay_asaas_1');
  });

  it('createPayment (CREDIT_CARD): sets status CONFIRMED immediately', async () => {
    asaas.ensureCustomer = jest.fn().mockResolvedValue('cust_123');
    asaas.createPayment = jest.fn().mockResolvedValue({
      id: 'pay_asaas_cc',
      status: 'CONFIRMED',
    });
    repo.updateStatus = jest.fn().mockResolvedValue({
      id: 'payment-uuid',
      orderId: 'order-uuid',
      status: PaymentStatus.CONFIRMED,
      providerPaymentId: 'pay_asaas_cc',
    });

    const out = await service.createPayment({
      cartItems: [{ productId: 'p1', name: 'Prod 1', quantity: 1, unitPrice: 100 }],
      totalAmount: 100,
      billingType: BillingType.CREDIT_CARD,
      customerData: { id: 'cust_local_2', email: 'contato@example.com', name: 'Jane' },
    });

    expect(repo.updateStatus).toHaveBeenCalledWith(expect.any(String), PaymentStatus.CONFIRMED, expect.objectContaining({
      providerPaymentId: 'pay_asaas_cc',
    }));
    expect(out.status).toBe(PaymentStatus.CONFIRMED);
  });

  it('createPayment: if Asaas fails, returns base created payment (fallback)', async () => {
    asaas.ensureCustomer = jest.fn().mockRejectedValue(new Error('down'));
    const out = await service.createPayment({
      cartItems: [{ productId: 'p1', name: 'Prod 1', quantity: 2, unitPrice: 10 }],
      totalAmount: 20,
      billingType: BillingType.BOLETO,
      customerData: { email: 'contato@example.com', name: 'John' },
    });

    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(out.status).toBe(PaymentStatus.PENDING);
    expect(out.providerPaymentId).toBeUndefined();
  });

  it('createPayment: rejects invalid payload (empty cart or non-positive amount)', async () => {
    await expect(service.createPayment({
      cartItems: [],
      totalAmount: 10,
      billingType: BillingType.PIX,
      customerData: { email: 'contato@example.com' },
    } as any)).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.createPayment({
      cartItems: [{ productId: 'p1', name: 'P', quantity: 1, unitPrice: 1 }],
      totalAmount: 0,
      billingType: BillingType.PIX,
      customerData: { email: 'contato@example.com' },
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---------- cancelPayment

  it('cancelPayment: cancels when not confirmed/refunded', async () => {
    repo.findById = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.PENDING });
    repo.updateStatus = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.CANCELED });

    const res = await service.cancelPayment('p1');
    expect(res.message).toContain('canceled');
    expect(repo.updateStatus).toHaveBeenCalledWith('p1', PaymentStatus.CANCELED);
  });

  it('cancelPayment: forbids when confirmed or refunded', async () => {
    repo.findById = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.CONFIRMED });
    await expect(service.cancelPayment('p1')).rejects.toBeInstanceOf(ForbiddenException);

    repo.findById = jest.fn().mockResolvedValue({ id: 'p2', status: PaymentStatus.REFUNDED });
    await expect(service.cancelPayment('p2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancelPayment: not found', async () => {
    repo.findById = jest.fn().mockResolvedValue(null);
    await expect(service.cancelPayment('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------- refundPayment

  it('refundPayment: only confirmed payments', async () => {
    repo.findById = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.PENDING });
    await expect(service.refundPayment('p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refundPayment: success updates status and calls orders.refundOrder', async () => {
    repo.findById = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.CONFIRMED, orderId: 'o1' });
    repo.updateStatus = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.REFUNDED });
    const res = await service.refundPayment('p1');

    expect(repo.updateStatus).toHaveBeenCalledWith('p1', PaymentStatus.REFUNDED);
    expect(orders.refundOrder).toHaveBeenCalledWith('o1');
    expect(res.message).toContain('refunded');
  });

  // ---------- handleWebhook / verifyWebhookSignature

  it('handleWebhook: invalid signature -> Forbidden', async () => {
    const raw = JSON.stringify({ any: 'payload' });
    const signature = 'bad';
    await expect(service.handleWebhook(raw, {
      providerPaymentId: 'xxx',
      status: 'CONFIRMED',
      signature,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handleWebhook: payment not found -> NotFound', async () => {
    // assinatura válida
    const raw = JSON.stringify({ hello: 'world' });
    const h = crypto.createHmac('sha256', 'supersecret').update(raw).digest('hex');

    repo.findByProviderPaymentId = jest.fn().mockResolvedValue(null);
    await expect(service.handleWebhook(raw, {
      providerPaymentId: 'nope',
      status: 'CONFIRMED',
      signature: h,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handleWebhook: CONFIRMED -> update payment and set order paid', async () => {
    const raw = JSON.stringify({ ok: true });
    const h = crypto.createHmac('sha256', 'supersecret').update(raw).digest('hex');

    repo.findByProviderPaymentId = jest.fn().mockResolvedValue({ id: 'p1', orderId: 'o1' });
    repo.updateStatus = jest.fn().mockResolvedValue({ id: 'p1', status: PaymentStatus.CONFIRMED });

    const res = await service.handleWebhook(raw, {
      providerPaymentId: 'prov_1',
      status: 'CONFIRMED',
      signature: h,
    });

    expect(repo.updateStatus).toHaveBeenCalledWith('p1', PaymentStatus.CONFIRMED);
    expect(orders.updateStatus).toHaveBeenCalledWith('o1', 'paid' as any);
    expect(res.ok).toBe(true);
  });

  it('handleWebhook: CANCELED -> order.cancelOrder', async () => {
    const raw = JSON.stringify({ any: 1 });
    const h = crypto.createHmac('sha256', 'supersecret').update(raw).digest('hex');

    repo.findByProviderPaymentId = jest.fn().mockResolvedValue({ id: 'p2', orderId: 'o2' });
    repo.updateStatus = jest.fn().mockResolvedValue({ id: 'p2', status: PaymentStatus.CANCELED });

    await service.handleWebhook(raw, {
      providerPaymentId: 'prov_2',
      status: 'CANCELED',
      signature: h,
    });

    expect(orders.cancelOrder).toHaveBeenCalledWith('o2');
  });

  it('handleWebhook: REFUNDED -> order.refundOrder', async () => {
    const raw = JSON.stringify({ any: 1 });
    const h = crypto.createHmac('sha256', 'supersecret').update(raw).digest('hex');

    repo.findByProviderPaymentId = jest.fn().mockResolvedValue({ id: 'p3', orderId: 'o3' });
    repo.updateStatus = jest.fn().mockResolvedValue({ id: 'p3', status: PaymentStatus.REFUNDED });

    await service.handleWebhook(raw, {
      providerPaymentId: 'prov_3',
      status: 'REFUNDED',
      signature: h,
    });

    expect(orders.refundOrder).toHaveBeenCalledWith('o3');
  });

  // ---------- delegates / list & get

  it('listAdmin delegates to repo', async () => {
    (repo.listAdmin as any) = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, pages: 1 });
    const res = await service.listAdmin();
    expect(repo.listAdmin).toHaveBeenCalled();
    expect(res.items).toBeDefined();
  });

  it('listByOrder delegates to repo', async () => {
    (repo.listByOrder as any) = jest.fn().mockResolvedValue([]);
    const res = await service.listByOrder('o1');
    expect(repo.listByOrder).toHaveBeenCalledWith('o1');
    expect(res).toEqual([]);
  });

  it('getById delegates to repo', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue({ id: 'p1' });
    const res = await service.getById('p1');
    expect(repo.findById).toHaveBeenCalledWith('p1');
    expect(res?.id).toBe('p1');
  });
});

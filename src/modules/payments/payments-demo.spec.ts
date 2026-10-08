import { PaymentsService } from './payments.service';
import { ForbiddenException } from '@nestjs/common';
import { BillingType } from './enums/billing-type.enum';
import { PaymentStatus } from './enums/payment-status.enum';

describe('Isolated demonstration checkout', () => {
  function setup(database = 'penrose_demo') {
    const draft = { id: 'draft', items: [{ productId: 'piece', name: 'Piece', quantity: 1, unitPrice: 180000, variant: { size: '30cm' } }], totals: { itemsSubtotal: 180000, shippingTotal: 1000, discountTotal: 0, grandTotal: 181000 }, coupons: [] };
    const config = { get: (key: string) => ({ COMMERCE_MODE: 'demo', MONGODB_DB: database }[key]) };
    const checkout = { getDraftForCart: jest.fn().mockResolvedValue(draft), validateForPayment: jest.fn() };
    const orders = { findByCheckoutDraftId: jest.fn().mockResolvedValue(null), createOrder: jest.fn(async (data) => ({ ...data, id: 'order' })), getById: jest.fn().mockResolvedValue({ customerId: 'customer' }), updateStatus: jest.fn() };
    const repo = { getOrCreateDemo: jest.fn(async (data) => data), findById: jest.fn().mockResolvedValue({ id: 'order', orderId: 'order', provider: 'DEMO', status: PaymentStatus.PENDING }), updateStatus: jest.fn() };
    const provider = { ensureCustomer: jest.fn(), createPayment: jest.fn() };
    const service = new PaymentsService(config as any, orders as any, repo as any, provider as any, checkout as any);
    return { service, orders, repo, provider, checkout };
  }

  const input = { draftId: 'draft', billingType: BillingType.PIX, cartItems: [], totalAmount: 1, customerData: { id: 'forged-customer' } };

  it('uses server prices and authenticated identity without calling a payment provider', async () => {
    const { service, orders, provider } = setup();
    const payment = await service.createDemoCheckout(input, 'customer', 'cart');
    expect(payment.amount).toBe(181000);
    expect(orders.createOrder).toHaveBeenCalledWith(expect.objectContaining({ shipping: expect.objectContaining({ provider: 'DEMO' }) }), 'draft');
    expect(orders.createOrder).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'customer', grandTotal: 181000 }), 'draft');
    expect(provider.ensureCustomer).not.toHaveBeenCalled();
    expect(provider.createPayment).not.toHaveBeenCalled();
  });

  it('refuses writes outside the isolated database', async () => {
    const { service, orders } = setup('production');
    await expect(service.createDemoCheckout(input, 'customer', 'cart')).rejects.toBeInstanceOf(ForbiddenException);
    expect(orders.createOrder).not.toHaveBeenCalled();
  });

  it('reuses an existing order for the same checkout', async () => {
    const { service, orders } = setup();
    orders.findByCheckoutDraftId.mockResolvedValue({ id: 'order', customerId: 'customer', grandTotal: 181000 });
    await service.createDemoCheckout(input, 'customer', 'cart');
    expect(orders.createOrder).not.toHaveBeenCalled();
  });

  it('rejects another customer approving the payment', async () => {
    const { service, repo, orders } = setup();
    await expect(service.resolveDemo('order', 'approve', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(orders.updateStatus).not.toHaveBeenCalled();
  });
});

import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

describe('CheckoutService current pricing', () => {
  function setup(stock: number) {
    const cart = { id: 'c1', version: 1, items: [{ sku: 'PNR-001', quantity: 2, unitPrice: 1000, discounts: [] }], coupons: [], taxTotal: 0 };
    const drafts = { create: jest.fn().mockImplementation(async (data) => ({ toJSON: () => data })) };
    const carts = { findById: jest.fn().mockResolvedValue(cart) };
    const products = { getPurchasableBySku: jest.fn().mockResolvedValue({ sku: 'PNR-001', priceCents: 25990, stock }) };
    const service = new CheckoutService(drafts as any, carts as any, {} as any, { get: jest.fn() } as any, products as any);
    return { service, drafts };
  }

  it('revalidates price before opening a checkout draft', async () => {
    const { service, drafts } = setup(2);
    const draft = await service.prepare('c1', 1);
    expect(draft.totals.itemsSubtotal).toBe(51980);
    expect(drafts.create).toHaveBeenCalledTimes(1);
  });

  it('blocks checkout when stock has run out', async () => {
    const { service, drafts } = setup(1);
    await expect(service.prepare('c1', 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(drafts.create).not.toHaveBeenCalled();
  });
});

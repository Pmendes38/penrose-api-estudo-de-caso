import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

describe('CartService pricing and stock', () => {
  const makeCart = () => ({ id: 'cart-1', status: 'active', version: 1, currency: 'BRL', locale: 'pt-BR', items: [], coupons: [], itemsSubtotal: 0, discountTotal: 0, shippingTotal: 0, taxTotal: 0, grandTotal: 0 });
  const product = { sku: 'PNR-001', priceCents: 25990, stock: 2 };

  function setup(stock = 2) {
    const cart = makeCart();
    const repo = { findById: jest.fn().mockResolvedValue(cart), updateByIdWithVersion: jest.fn().mockImplementation(async (_id, _version, patch) => ({ ...cart, ...patch })) };
    const products = { getPurchasableBySku: jest.fn().mockResolvedValue({ ...product, stock }) };
    const checkout = { abandonAllForCart: jest.fn().mockResolvedValue(undefined) };
    const service = new CartService(repo as any, {} as any, { del: jest.fn() } as any, checkout as any, products as any);
    return { service, repo, products, cart };
  }

  it('adds using current product price, not the old fixed price', async () => {
    const { service, repo } = setup();
    const result = await service.addItem('cart-1', 1, { sku: 'PNR-001', quantity: 2 });
    expect(result.items[0].unitPrice).toBe(25990);
    expect(result.itemsSubtotal).toBe(51980);
    expect(repo.updateByIdWithVersion).toHaveBeenCalledTimes(1);
  });

  it('rejects a quantity beyond stock without changing the cart', async () => {
    const { service, repo, cart } = setup(1);
    await expect(service.addItem('cart-1', 1, { sku: 'PNR-001', quantity: 2 })).rejects.toBeInstanceOf(BadRequestException);
    expect(cart.items).toHaveLength(0);
    expect(repo.updateByIdWithVersion).not.toHaveBeenCalled();
  });
});

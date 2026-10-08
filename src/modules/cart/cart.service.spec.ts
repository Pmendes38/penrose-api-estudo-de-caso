import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

describe('CartService pricing and stock', () => {
  const makeCart = () => ({ id: 'cart-1', status: 'active', version: 1, currency: 'BRL', locale: 'pt-BR', items: [], coupons: [], itemsSubtotal: 0, discountTotal: 0, shippingTotal: 0, taxTotal: 0, grandTotal: 0 });
  const product = { sku: 'PNR-001', priceCents: 25990, stock: 2 };

  function setup(stock = 2) {
    const cart = makeCart();
    const repo = { findById: jest.fn().mockResolvedValue(cart), updateByIdWithVersion: jest.fn().mockImplementation(async (_id, _version, patch) => ({ ...cart, ...patch })) };
    const products = { getPurchasableBySku: jest.fn().mockResolvedValue({ ...product, stock }), priceForVariant: jest.fn((item, variant) => item.madeToOrder && variant?.size === '30cm' ? 180000 : item.priceCents) };
    const checkout = { abandonAllForCart: jest.fn().mockResolvedValue(undefined) };
    const service = new CartService(repo as any, {} as any, { del: jest.fn() } as any, checkout as any, products as any, { cartDiscount: jest.fn().mockResolvedValue(0) } as any);
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

  it('accepts made-to-order pieces with no physical stock', async () => {
    const { service, products } = setup(0);
    products.getPurchasableBySku.mockResolvedValueOnce({ ...product, stock: 0, madeToOrder: true } as any);
    const result = await service.addItem('cart-1', 1, { sku: 'PNR-001', quantity: 2 });
    expect(result.itemsSubtotal).toBe(51980);
  });

  it('stores the selected 30 cm promotional price in the cart', async () => {
    const { service, products } = setup(0);
    products.getPurchasableBySku.mockResolvedValueOnce({ ...product, stock: 0, madeToOrder: true } as any);
    const result = await service.addItem('cart-1', 1, { sku: 'PNR-001', quantity: 1, variant: { size: '30cm' } });
    expect(result.items[0].unitPrice).toBe(180000);
  });

  it('reprices an item when its size changes', async () => {
    const { service, products } = setup(0);
    products.getPurchasableBySku.mockResolvedValue({ ...product, stock: 0, madeToOrder: true } as any);
    const added = await service.addItem('cart-1', 1, { sku: 'PNR-001', quantity: 1, variant: { size: '20cm' } });
    products.priceForVariant.mockImplementation((_item, variant) => variant?.size === '40cm' ? 320000 : 160000);
    const updated = await service.updateItem('cart-1', 1, added.items[0].id, { variant: { size: '40cm' } });
    expect(updated.items[0].unitPrice).toBe(320000);
  });

  it('keeps the delivery address and identifies demo shipping without requiring an invoice', async () => {
    const { service, cart } = setup();
    Object.assign(cart, { shippingQuotes: { expiresAt: Date.now() + 60000, postalCode: '72850180', quotes: [{ serviceCode: 'demo', label: 'Entrega simulada', amount: 0, days: 5, source: 'demo' }] } });
    const selected = await service.selectShipping('cart-1', 1, { serviceCode: 'demo', address: { endereco: 'Rua Demonstração', numero: '10' } });
    expect(selected.shippingAddress).toEqual(expect.objectContaining({ postalCode: '72850180', endereco: 'Rua Demonstração', numero: '10' }));
    expect(selected.shipping?.label).toBe('Entrega simulada');
  });
});

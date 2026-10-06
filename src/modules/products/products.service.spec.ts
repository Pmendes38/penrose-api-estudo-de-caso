import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repo/products.repository';
import { ProductStatus } from './enums/product-status.enum';

describe('ProductsService', () => {
  let service: ProductsService;

  const repo = {
    // queries
    findPublicPaged: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findBySku: jest.fn(),
    findAdminPaged: jest.fn(),

    // mutations
    create: jest.fn(async (doc: any) => ({ toJSON: () => doc })),
    updateById: jest.fn(),
    deleteById: jest.fn(),

    // helpers
    incStock: jest.fn(),
    addImage: jest.fn(),
    removeImage: jest.fn(),
    addTag: jest.fn(),
    removeTag: jest.fn(),
  } as unknown as jest.Mocked<ProductsRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
  });

  // ---------------- Public list / find

  it('seeds the empty catalog as made-to-order without inventing stock', async () => {
    (repo.findBySku as any).mockResolvedValue(null);
    await service.onModuleInit();
    expect(repo.create).toHaveBeenCalledTimes(29);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ sku: 'PNR-001', priceCents: 25990, stock: 0, madeToOrder: true }));
    expect(repo.create).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Kakashi Hatake' }));
  });

  it('returns only active products with valid current prices for the cart', async () => {
    (repo.findBySku as any).mockResolvedValueOnce({ sku: 'PNR-001', status: ProductStatus.ACTIVE, priceCents: 25990, stock: 2 });
    await expect(service.getPurchasableBySku('pnr-001')).resolves.toMatchObject({ priceCents: 25990, stock: 2 });
    expect(repo.findBySku).toHaveBeenCalledWith('PNR-001');
    (repo.findBySku as any).mockResolvedValueOnce({ status: ProductStatus.INACTIVE, priceCents: 25990 });
    await expect(service.getPurchasableBySku('PNR-001')).rejects.toBeInstanceOf(NotFoundException);
    (repo.findBySku as any).mockResolvedValueOnce({ status: ProductStatus.ACTIVE, priceCents: 0 });
    await expect(service.getPurchasableBySku('PNR-001')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listPublic delegates to repository with provided query', async () => {
    (repo.findPublicPaged as any) = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, pages: 1 });
    const out = await service.listPublic({ page: 1, pageSize: 20 } as any);
    expect(repo.findPublicPaged).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(out.items).toBeDefined();
  });

  it('findPublicByIdOrSlug: returns by id when active', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue({ id: 'p1', status: ProductStatus.ACTIVE });
    const out = await service.findPublicByIdOrSlug('p1');
    expect(out.success).toBe(true);
    expect(out.product.id).toBe('p1');
  });

  it('findPublicByIdOrSlug: falls back to slug when id not active/found', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue(null);
    (repo.findBySlug as any) = jest.fn().mockResolvedValue({ id: 'p2', slug: 'awesome', status: ProductStatus.ACTIVE });
    const out = await service.findPublicByIdOrSlug('awesome');
    expect(repo.findBySlug).toHaveBeenCalledWith('awesome');
    expect(out.product.slug).toBe('awesome');
  });

  it('findPublicByIdOrSlug: throws NotFound when neither id nor slug active', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue(null);
    (repo.findBySlug as any) = jest.fn().mockResolvedValue(null);
    await expect(service.findPublicByIdOrSlug('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findPublicByIdOrSlug: throws BadRequest when empty', async () => {
    await expect(service.findPublicByIdOrSlug('')).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---------------- Admin list

  it('listAdmin delegates to repository', async () => {
    (repo.findAdminPaged as any) = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, pages: 1 });
    const out = await service.listAdmin();
    expect(repo.findAdminPaged).toHaveBeenCalledWith(1, 50);
    expect(out.items).toBeDefined();
  });

  // ---------------- Create

  it('createAdmin: success returns created product', async () => {
    const res = await service.createAdmin({
      name: 'My Product',
      priceCents: 1234,
      images: ['http://img'],
      tags: ['Tag'],
    } as any);
    expect(repo.create).toHaveBeenCalled();
    expect(res.message).toContain('Product created');
    expect(res.product.name).toBe('My Product');
    expect(res.product.slug).toBe('my-product'); // slugify
  });

  it('createAdmin: rejects when name missing', async () => {
    await expect(service.createAdmin({ priceCents: 100 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createAdmin: rejects when price invalid', async () => {
    await expect(service.createAdmin({ name: 'X', priceCents: -1 } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createAdmin: duplicate slug/SKU -> Conflict', async () => {
    (repo.create as any) = jest.fn().mockRejectedValue({ code: 11000 });
    await expect(service.createAdmin({ name: 'Dup', priceCents: 100 } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  // ---------------- Update

  it('updateAdmin: success updates and returns product (slug changes with name)', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue({ id: 'p1', name: 'Old Name', slug: 'old-name' });
    (repo.updateById as any) = jest.fn().mockImplementation((_id: string, set: any) => {
      expect(set.name).toBe('New Name');
      expect(set.slug).toBe('new-name');
      return { id: 'p1', name: set.name, slug: set.slug, priceCents: 100 };
    });
    const out = await service.updateAdmin('p1', { name: 'New Name' } as any);
    expect(repo.updateById).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'New Name', slug: 'new-name' }));
    expect(out.product.slug).toBe('new-name');
  });

  it('updateAdmin: NotFound when repo returns null', async () => {
    (repo.updateById as any) = jest.fn().mockResolvedValue(null);
    await expect(service.updateAdmin('missing', { priceCents: 200 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateAdmin: duplicate slug/SKU -> Conflict', async () => {
    (repo.findById as any) = jest.fn().mockResolvedValue({ id: 'p1', name: 'Old Name', slug: 'old-name' });
    (repo.updateById as any) = jest.fn().mockRejectedValue({ code: 11000 });
    await expect(service.updateAdmin('p1', { sku: 'SKU-1' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  // ---------------- Delete

  it('deleteAdmin: success when deletedCount > 0', async () => {
    (repo.deleteById as any) = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const res = await service.deleteAdmin('p1');
    expect(res.message).toContain('deleted');
  });

  it('deleteAdmin: NotFound when nothing deleted', async () => {
    (repo.deleteById as any) = jest.fn().mockResolvedValue({ deletedCount: 0 });
    await expect(service.deleteAdmin('p1')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ---------------- Stock helpers

  it('increaseStock: validates amount > 0 and returns updated doc', async () => {
    (repo.incStock as any) = jest.fn().mockResolvedValue({ id: 'p1', stock: 10 });
    const out = await service.increaseStock('p1', 5);
    expect(repo.incStock).toHaveBeenCalledWith('p1', 5);
    expect(out.stock).toBe(10);
  });

  it('increaseStock: rejects non-positive amount', async () => {
    await expect(service.increaseStock('p1', 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('decreaseStock: rejects non-positive amount', async () => {
    await expect(service.decreaseStock('p1', 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('decreaseStock: NotFound when repo returns null', async () => {
    (repo.incStock as any) = jest.fn().mockResolvedValue(null);
    await expect(service.decreaseStock('missing', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('decreaseStock: rolls back and throws when stock would be negative', async () => {
    const incMock = jest.fn()
      .mockResolvedValueOnce({ id: 'p1', stock: -1 }) // primeira chamada: ficou negativo
      .mockResolvedValueOnce({ id: 'p1', stock: 0 }); // rollback
    (repo.incStock as any) = incMock;

    await expect(service.decreaseStock('p1', 2)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.incStock).toHaveBeenNthCalledWith(1, 'p1', -2);
    expect(repo.incStock).toHaveBeenNthCalledWith(2, 'p1', 2); // rollback
  });

  // ---------------- Images / Tags

  it('addImage: rejects empty url', () => {
    expect(() => service.addImage('p1', '  ')).toThrow(BadRequestException);
  });

  it('removeImage: rejects empty url', () => {
    expect(() => service.removeImage('p1', '')).toThrow(BadRequestException);
  });

  it('addTag/removeTag: reject empty tag', () => {
    expect(() => service.addTag('p1', ' ')).toThrow(BadRequestException);
    expect(() => service.removeTag('p1', '')).toThrow(BadRequestException);
  });

  it('addImage/addTag/removeImage/removeTag: delegates to repo', async () => {
    (repo.addImage as any) = jest.fn().mockResolvedValue({ id: 'p1', images: ['a'] });
    (repo.addTag as any) = jest.fn().mockResolvedValue({ id: 'p1', tags: ['t'] });
    (repo.removeImage as any) = jest.fn().mockResolvedValue({ id: 'p1', images: [] });
    (repo.removeTag as any) = jest.fn().mockResolvedValue({ id: 'p1', tags: [] });

    await service.addImage('p1', 'http://x');
    await service.addTag('p1', 'Tag');
    await service.removeImage('p1', 'http://x');
    await service.removeTag('p1', 'Tag');

    expect(repo.addImage).toHaveBeenCalledWith('p1', 'http://x');
    expect(repo.addTag).toHaveBeenCalledWith('p1', 'tag');
    expect(repo.removeImage).toHaveBeenCalledWith('p1', 'http://x');
    expect(repo.removeTag).toHaveBeenCalledWith('p1', 'tag');
  });
});

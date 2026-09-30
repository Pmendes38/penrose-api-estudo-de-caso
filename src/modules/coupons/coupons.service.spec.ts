import { Test } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './repo/coupons.repository';
import { CouponType } from './enums/coupon-type.enum';

jest.mock('./repo/coupons.repository', () => {
  class CouponsRepositoryMock {}
  return { CouponsRepository: CouponsRepositoryMock };
});

describe('CouponsService', () => {
  let service: CouponsService;
  const repo = {
    listAdmin: jest.fn(),
    create: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    listAvailable: jest.fn(),
    findByCode: jest.fn(),
  } as unknown as jest.Mocked<CouponsRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: CouponsRepository, useValue: repo },
      ],
    }).compile();
    service = mod.get(CouponsService);
  });

  it('creates a coupon (percent) and enforces unique code', async () => {
    repo.findByCode = jest.fn().mockResolvedValue(null);
    repo.create = jest.fn().mockResolvedValue({ toJSON: () => ({ id: 'c1', code: 'BLACK' }) });

    const out = await service.createAdmin({
      code: 'black',
      description: 'BF',
      type: CouponType.PERCENT,
      value: 10,
      startsAt: new Date(Date.now() + 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    } as any);

    expect(out.code).toBe('BLACK');
    expect(repo.create).toHaveBeenCalled();
  });

  it('rejects invalid percent value', async () => {
    await expect(service.createAdmin({
      code: 'X',
      description: 'x',
      type: CouponType.PERCENT,
      value: 150,
      startsAt: new Date(Date.now() + 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    } as any)).rejects.toThrow('Percent coupon value must be between 0 and 100');
  });

  it('lists available', async () => {
    repo.listAvailable = jest.fn().mockResolvedValue([{ id: 'c1' }]);
    const res = await service.listAvailable();
    expect(res).toHaveLength(1);
  });

  it('updates coupon', async () => {
    repo.updateById = jest.fn()
      .mockResolvedValueOnce({ id: 'c1', type: CouponType.FIXED, value: 10, startsAt: new Date().toISOString(), endsAt: new Date(Date.now()+86400000).toISOString(), minimumOrderValue: 0 })
      .mockResolvedValueOnce({ id: 'c1', description: 'new' });

    const out = await service.updateAdmin('c1', { description: 'new' } as any);
    expect(out.description).toBe('new');
  });

  it('deletes coupon', async () => {
    repo.deleteById = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const res = await service.removeAdmin('c1');
    expect(res.message).toContain('deleted');
  });
});
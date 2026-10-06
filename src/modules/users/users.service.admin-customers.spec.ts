import { UsersService } from './users.service';

describe('UsersService.listAdminCustomers', () => {
  it('combines registered customers with paid order totals without inventing missing activity', async () => {
    const repo = {
      listAdminProfiles: jest.fn().mockResolvedValue([
        { id: 'one', name: 'Ana', email: 'ana@example.com', createdAt: new Date('2026-01-01') },
        { id: 'two', name: 'Bia', email: 'bia@example.com' },
      ]),
      listAdminOrderStats: jest.fn().mockResolvedValue([{ _id: 'one', totalOrders: 3, paidOrders: 2, totalSpent: 480, lastOrder: new Date('2026-02-01') }]),
    };
    const service = new UsersService(repo as any, {} as any, {} as any);
    const result = await service.listAdminCustomers();
    expect(result[0]).toMatchObject({ totalOrders: 3, paidOrders: 2, totalSpent: 480 });
    expect(result[1]).toMatchObject({ totalOrders: 0, paidOrders: 0, totalSpent: 0, lastOrder: null });
    expect(result[0]).not.toHaveProperty('passwordHash');
  });
});

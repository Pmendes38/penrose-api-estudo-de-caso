import { Test } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repo/orders.repository';
import { CountersRepository } from './repo/counters.repository';
import { OrderStatus } from './enums/order-status.enum';

describe('OrdersService', () => {
  let service: OrdersService;
  const ordersRepo = {
    findPagedForAdmin: jest.fn(),
    findById: jest.fn(),
    findByCustomer: jest.fn(),
    create: jest.fn(async (doc: any) => ({ toJSON: () => doc })),
    updateStatus: jest.fn(),
    requestCancellation: jest.fn(),
  } as unknown as jest.Mocked<OrdersRepository>;
  const countersRepo = { next: jest.fn(async () => 1) } as unknown as jest.Mocked<CountersRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: ordersRepo },
        { provide: CountersRepository, useValue: countersRepo },
      ],
    }).compile();
    service = mod.get(OrdersService);
  });

  it('creates order and returns sequential orderNumber', async () => {
    const out = await service.createOrder({
      customerId: 'uuid-123',
      items: [{ productId: 'p1', name: 'Prod 1', quantity: 2, unitPrice: 10 }],
      subtotal: 20, shippingTotal: 5, discountTotal: 0, grandTotal: 25,
    } as any);
    expect(out.orderNumber).toBe(1);
    expect(ordersRepo.create).toHaveBeenCalled();
  });

  it('updates status respecting transitions', async () => {
    (ordersRepo.findById as any) = jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.PAID });
    (ordersRepo.updateStatus as any) = jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.SHIPPED });
    const res = await service.updateStatus('o1', OrderStatus.SHIPPED);
    expect(res.order.status).toBe(OrderStatus.SHIPPED);
  });

  it('rejects invalid transition', async () => {
    (ordersRepo.findById as any) = jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.PENDING });
    await expect(service.updateStatus('o1', OrderStatus.DELIVERED)).rejects.toThrow('Transition pending -> delivered is not allowed');
  });

  it('saves one cancellation request without changing a paid order or accepting another customer', async () => {
    const order = { id: 'o1', customerId: 'c1', status: OrderStatus.PAID };
    ordersRepo.findById.mockResolvedValue(order as any);
    const requested = { ...order, cancellationRequest: { reason: 'Tamanho errado', requestedAt: new Date() } };
    ordersRepo.requestCancellation.mockResolvedValue(requested as any);
    expect((await service.requestCancellation('o1', 'c1', ' Tamanho errado ')).status).toBe(OrderStatus.PAID);
    expect(ordersRepo.requestCancellation).toHaveBeenCalledWith('o1', 'c1', 'Tamanho errado');
    await expect(service.requestCancellation('o1', 'other', 'Motivo')).rejects.toThrow();
    ordersRepo.findById.mockResolvedValue(requested as any);
    await service.requestCancellation('o1', 'c1', 'Outro motivo');
    expect(ordersRepo.requestCancellation).toHaveBeenCalledTimes(1);
    ordersRepo.findById.mockResolvedValue({ ...order, status: OrderStatus.SHIPPED } as any);
    await expect(service.requestCancellation('o1', 'c1', 'Motivo')).rejects.toThrow();
    await expect(service.requestCancellation('o1', 'c1', ' '.repeat(5))).rejects.toThrow();
  });
});

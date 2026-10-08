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
    updateProduction: jest.fn(),
    listProduction: jest.fn(),
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
      shipping: { label: 'Entrega simulada', provider: 'DEMO', days: 5 },
      shippingAddress: { postalCode: '72850180', endereco: 'Rua Demonstração', numero: '10' },
    } as any);
    expect(out.orderNumber).toBe(1);
    expect(out.shippingAddress?.endereco).toBe('Rua Demonstração');
    expect(out.shipping?.provider).toBe('DEMO');
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

  it('queues paid orders and rejects unpaid orders, skipped stages and concurrent changes', async () => {
    const paid = { id: 'o1', status: OrderStatus.PAID };
    ordersRepo.findById.mockResolvedValue(paid as any);
    ordersRepo.updateProduction.mockResolvedValue({ ...paid, productionStage: 'todo' } as any);
    expect((await service.updateProduction('o1', 'todo', 'admin1')).productionStage).toBe('todo');
    expect(ordersRepo.updateProduction).toHaveBeenCalledWith('o1', undefined, 'todo', 'admin1');
    await expect(service.updateProduction('o1', 'ready', 'admin1')).rejects.toThrow('Mova uma etapa');
    ordersRepo.findById.mockResolvedValue({ ...paid, productionStage: 'todo' } as any);
    await service.updateProduction('o1', 'todo', 'admin1');
    expect(ordersRepo.updateProduction).toHaveBeenCalledTimes(1);
    ordersRepo.updateProduction.mockResolvedValue(null);
    await expect(service.updateProduction('o1', 'printing', 'admin1')).rejects.toThrow('O pedido mudou');
    ordersRepo.findById.mockResolvedValue({ ...paid, status: OrderStatus.PENDING } as any);
    await expect(service.updateProduction('o1', 'todo', 'admin1')).rejects.toThrow('pagamento aprovado');
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

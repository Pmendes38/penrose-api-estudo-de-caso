import {
  Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { OrdersRepository } from './repo/orders.repository';
import { CountersRepository } from './repo/counters.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './enums/order-status.enum';
import { PRODUCTION_STAGES, ProductionStage } from './dto/update-production.dto';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]:     [OrderStatus.PROCESSING, OrderStatus.PAID, OrderStatus.CANCELED],
  [OrderStatus.PROCESSING]:  [OrderStatus.PAID, OrderStatus.CANCELED],
  [OrderStatus.PAID]:        [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]:     [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]:   [],
  [OrderStatus.CANCELED]:    [],
  [OrderStatus.REFUNDED]:    [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly countersRepo: CountersRepository,
  ) {}

  listAdmin(page = 1, pageSize = 20) {
    return this.ordersRepo.findPagedForAdmin(page, pageSize);
  }

  getById(id: string) {
    return this.ordersRepo.findById(id);
  }

  listByCustomer(customerId: string, page = 1, pageSize = 20) {
    return this.ordersRepo.findByCustomer(customerId, page, pageSize);
  }

  async createOrder(dto: CreateOrderDto, checkoutDraftId?: string) {
    if (!dto.items?.length) throw new BadRequestException('Order must have at least one item');

    const subtotalCalc = (dto.items as any[]).reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      0,
    );

    if (Math.abs(subtotalCalc - Number(dto.subtotal)) > 1) {
      throw new BadRequestException('Subtotal mismatch');
    }

    const expectedGrand = Number(dto.subtotal) + Number(dto.shippingTotal) - Number(dto.discountTotal);
    if (Number(dto.grandTotal) !== expectedGrand) {
      throw new BadRequestException('Grand total mismatch');
    }

    const orderNumber = await this.countersRepo.next('orderNumber');

    const doc = {
      id: crypto.randomUUID(),
      checkoutDraftId,
      orderNumber,
      customerId: dto.customerId,
      items: dto.items,
      status: OrderStatus.PENDING,
      statusHistory: [{ status: OrderStatus.PENDING, at: new Date(), note: 'Order created' }],
      subtotal: dto.subtotal,
      shippingTotal: dto.shippingTotal,
      discountTotal: dto.discountTotal,
      grandTotal: dto.grandTotal,
      couponCode: dto.couponCode,
      notes: dto.notes,
      shipping: dto.shipping,
      shippingAddress: dto.shippingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const created = await this.ordersRepo.create(doc as any);
      return created.toJSON();
    } catch (error: any) {
      this.logger.error(JSON.stringify({ type: error?.name, code: error?.code, fields: Object.keys(error?.errors ?? {}) }));
      if (error?.code === 11000 && checkoutDraftId) {
        const existing = await this.ordersRepo.findByCheckoutDraftId(checkoutDraftId);
        if (existing) return existing;
      }
      throw new InternalServerErrorException('Failed to create order');
    }
  }

  async updateStatus(id: string, newStatus: OrderStatus, changedBy?: string) {
    const current = await this.ordersRepo.findById(id);
    if (!current) throw new NotFoundException('Order not found');
    if (current.status === newStatus) return { message: 'Status unchanged', order: current };

    const allowed = ALLOWED_TRANSITIONS[current.status as OrderStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ForbiddenException(`Transition ${current.status} -> ${newStatus} is not allowed`);
    }

    const updated = await this.ordersRepo.updateStatus(
      id,
      newStatus,
      { status: newStatus, at: new Date(), changedBy },
    );
    if (!updated) throw new InternalServerErrorException('Failed to update status');

    return { message: 'Status updated successfully', order: updated };
  }

  async cancelOrder(id: string, changedBy?: string) {
    return this.updateStatus(id, OrderStatus.CANCELED, changedBy);
  }

  async requestCancellation(id: string, customerId: string, reason: string) {
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new BadRequestException('Informe um motivo com até 500 caracteres');
    const current = await this.ordersRepo.findById(id);
    if (!current || current.customerId !== customerId) throw new ForbiddenException();
    if (![OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.PAID].includes(current.status)) throw new BadRequestException('Este pedido não permite solicitação de cancelamento');
    if (current.cancellationRequest) return current;
    const updated = await this.ordersRepo.requestCancellation(id, customerId, reason.trim());
    if (!updated) throw new BadRequestException('O pedido mudou. Atualize a página antes de tentar novamente');
    return updated;
  }

  listProduction() { return this.ordersRepo.listProduction(); }

  async updateProduction(id: string, stage: ProductionStage, changedBy: string) {
    if (!PRODUCTION_STAGES.includes(stage)) throw new BadRequestException('Etapa inválida');
    const current = await this.ordersRepo.findById(id);
    if (!current) throw new NotFoundException('Pedido não encontrado');
    if (current.status !== OrderStatus.PAID) throw new ForbiddenException('A produção exige pagamento aprovado');
    if (current.productionStage === stage) return current;
    const from = current.productionStage ? PRODUCTION_STAGES.indexOf(current.productionStage) : -1;
    const to = PRODUCTION_STAGES.indexOf(stage);
    if ((from === -1 && to !== 0) || (from !== -1 && Math.abs(from - to) !== 1)) throw new BadRequestException('Mova uma etapa por vez');
    const updated = await this.ordersRepo.updateProduction(id, current.productionStage, stage, changedBy);
    if (!updated) throw new ConflictException('O pedido mudou. Atualize o quadro antes de tentar novamente');
    return updated;
  }

  findByCheckoutDraftId(id: string) {
    return this.ordersRepo.findByCheckoutDraftId(id);
  }

  async refundOrder(id: string, changedBy?: string) {
    return this.updateStatus(id, OrderStatus.REFUNDED, changedBy);
  }
}

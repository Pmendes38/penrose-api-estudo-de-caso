import {
  Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { OrdersRepository } from './repo/orders.repository';
import { CountersRepository } from './repo/counters.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './enums/order-status.enum';

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const created = await this.ordersRepo.create(doc as any);
      return created.toJSON();
    } catch (error: any) {
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

  findByCheckoutDraftId(id: string) {
    return this.ordersRepo.findByCheckoutDraftId(id);
  }

  async refundOrder(id: string, changedBy?: string) {
    return this.updateStatus(id, OrderStatus.REFUNDED, changedBy);
  }
}

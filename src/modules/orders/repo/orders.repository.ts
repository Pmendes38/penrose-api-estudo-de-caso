import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order, OrderDocument } from '../schemas/order.schema';
import { Model } from 'mongoose';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrdersRepository {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>) {}

  findPagedForAdmin(page: number, pageSize: number) {
    const skip = Math.max(0, (page - 1) * pageSize);
    return Promise.all([
      this.orderModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
      this.orderModel.countDocuments().exec(),
    ]).then(([items, total]) => ({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }));
  }

  findById(id: string) {
    return this.orderModel.findOne({ id }).lean().exec();
  }

  findByCheckoutDraftId(checkoutDraftId: string) {
    return this.orderModel.findOne({ checkoutDraftId }).lean().exec();
  }

  findByOrderNumber(orderNumber: number) {
    return this.orderModel.findOne({ orderNumber }).lean().exec();
  }

  findByCustomer(customerId: string, page = 1, pageSize = 20) {
    const skip = Math.max(0, (page - 1) * pageSize);
    return Promise.all([
      this.orderModel.find({ customerId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
      this.orderModel.countDocuments({ customerId }).exec(),
    ]).then(([items, total]) => ({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }));
  }

  create(doc: Order) {
    return this.orderModel.create(doc);
  }

  requestCancellation(id: string, customerId: string, reason: string) {
    return this.orderModel.findOneAndUpdate(
      { id, customerId, status: { $in: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.PAID] }, cancellationRequest: { $exists: false } },
      { $set: { cancellationRequest: { reason, requestedAt: new Date() } } },
      { new: true },
    ).lean().exec();
  }

  updateStatus(id: string, status: OrderStatus, historyEntry: { status: OrderStatus; at: Date; note?: string; changedBy?: string }) {
    return this.orderModel
      .findOneAndUpdate(
        { id },
        { $set: { status }, $push: { statusHistory: historyEntry } },
        { new: true },
      )
      .lean()
      .exec();
  }
}

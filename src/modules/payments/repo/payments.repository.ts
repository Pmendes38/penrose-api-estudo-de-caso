import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Model } from 'mongoose';
import { PaymentStatus } from '../enums/payment-status.enum';

@Injectable()
export class PaymentsRepository {
  constructor(@InjectModel(Payment.name) private readonly model: Model<PaymentDocument>) {}

  create(doc: Payment) { return this.model.create(doc); }

  findById(id: string) { return this.model.findOne({ id }).lean().exec(); }

  findByProviderPaymentId(providerPaymentId: string) {
    return this.model.findOne({ providerPaymentId }).lean().exec();
  }

  listAdmin(
    page = 1,
    pageSize = 20,
    filter: Partial<{ status: string; billingType: string; orderId: string; providerPaymentId: string }> = {},
  ) {
    const skip = Math.max(0, (page - 1) * pageSize);
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.billingType) where.billingType = filter.billingType;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.providerPaymentId) where.providerPaymentId = filter.providerPaymentId;

    return Promise.all([
      this.model.find(where).sort({ createdAt: -1 }).skip(skip).limit(Math.max(1, Math.min(100, pageSize))).lean().exec(),
      this.model.countDocuments(where).exec(),
    ]).then(([items, total]) => ({
      items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)),
    }));
  }

  listByOrder(orderId: string) {
    return this.model.find({ orderId }).sort({ createdAt: -1 }).lean().exec();
  }

  updateStatus(id: string, status: PaymentStatus, patch: Partial<Payment> = {}) {
    return this.model.findOneAndUpdate(
      { id },
      { $set: { status, ...patch }, $push: { statusHistory: { status, at: new Date() } } },
      { new: true },
    ).lean().exec();
  }
}

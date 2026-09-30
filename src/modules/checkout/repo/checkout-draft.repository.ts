import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CheckoutDraft, CheckoutDraftDocument } from '../schemas/checkout-draft.schema';

@Injectable()
export class CheckoutDraftRepository {
  constructor(@InjectModel(CheckoutDraft.name) private model: Model<CheckoutDraftDocument>) {}

  create(data: Partial<CheckoutDraft>) {
    return this.model.create(data);
  }

  findByIdForCart(id: string, cartId: any) {
    return this.model.findOne({ id, cartId }).lean().exec();
  }

  findOpenByCartAndIdem(cartId: any, idempotencyKey: string) {
    return this.model.findOne({ cartId, idempotencyKey, status: 'open' }).lean().exec();
  }

  async markCompleted(id: string) {
    return this.model.findOneAndUpdate({ id }, { $set: { status: 'completed' } }, { new: true }).lean().exec();
  }

  async abandonAllForCart(cartId: any) {
    await this.model.updateMany({ cartId, status: 'open' }, { $set: { status: 'abandoned' } }).exec();
  }

  async patchById(id: string, patch: Partial<CheckoutDraft>) {
    return this.model
      .findOneAndUpdate({ id }, { $set: patch }, { new: true })
      .lean()
      .exec();
  }
}

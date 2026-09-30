import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from '../schemas/cart.schema';

@Injectable()
export class CartRepository {
  constructor(@InjectModel(Cart.name) private model: Model<CartDocument>) {}

  create(data: Partial<Cart>) {
    return this.model.create(data);
  }

  findById(id: string) {
    return this.model.findById(id).lean().exec();
  }

  findActiveByUser(userId: string) {
    return this.model.findOne({ userId, status: 'active' }).lean().exec();
  }

  async updateByIdWithVersion(id: string, expectedVersion: number, patch: Partial<Cart>) {
    const { version, _id, id: idField, createdAt, updatedAt, ...$set } = (patch ?? {}) as any;

    const res = await this.model
      .findOneAndUpdate(
        { _id: id, version: expectedVersion },
        { $set, $inc: { version: 1 } },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    return res;
  }

  async setStatus(id: string, status: Cart['status']) {
    return this.model
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .lean()
      .exec();
  }
}

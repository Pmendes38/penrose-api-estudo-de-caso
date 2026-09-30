import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Coupon, CouponDocument } from '../schemas/coupon.schema';
import { DeleteResult, Model } from 'mongoose';

@Injectable()
export class CouponsRepository {
  constructor(@InjectModel(Coupon.name) private readonly couponModel: Model<CouponDocument>) {}

  listAdmin() {
    return this.couponModel.find({}).sort({ createdAt: -1 }).lean().exec();
  }

  create(doc: Partial<Coupon>) {
    return this.couponModel.create(doc);
  }

  updateById(id: string, set: Partial<Coupon>) {
    return this.couponModel.findOneAndUpdate({ id }, { $set: set }, { new: true }).lean().exec();
  }

  async deleteById(id: string): Promise<DeleteResult> {
    return this.couponModel.deleteOne({ id }).exec();
  }

  listAvailable(nowISO: string) {
    const now = new Date(nowISO);
    return this.couponModel
      .find({
        active: true,
        startsAt: { $lte: now },
        endsAt: { $gte: now },
        $or: [
          { maxRedemptions: null },
          { $expr: { $lt: ['$currentRedemptions', '$maxRedemptions'] } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  findByCode(code: string) {
    return this.couponModel.findOne({ code }).lean().exec();
  }

  async incRedemptions(id: string, delta = 1) {
    return this.couponModel.findOneAndUpdate(
      { id },
      { $inc: { currentRedemptions: delta }, $set: { updatedAt: new Date() } },
      { new: true },
    ).lean().exec();
  }
}

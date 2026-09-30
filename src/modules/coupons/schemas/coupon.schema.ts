import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';
import { CouponType } from '../enums/coupon-type.enum';

export type CouponDocument = HydratedDocument<Coupon>;

const options: SchemaOptions = {
  collection: 'coupons',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: unknown, ret: Record<string, unknown>) => {
      if ('_id' in ret) delete (ret as any)._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

@Schema(options)
export class Coupon {
  @Prop({ type: String, required: true, unique: true, index: true })
  id!: string;

  @Prop({ type: String, required: true, uppercase: true, trim: true, unique: true, index: true })
  code!: string;

  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: String, required: true, enum: Object.values(CouponType) })
  type!: CouponType;

  @Prop({ type: Number, required: true })
  value!: number;

  @Prop({ type: Number, required: false, default: null })
  minimumOrderValue?: number | null;

  @Prop({ type: Number, required: false, default: null })
  maxRedemptions?: number | null;

  @Prop({ type: Number, required: true, default: 0 })
  currentRedemptions!: number;

  @Prop({ type: Date, required: true })
  startsAt!: Date;

  @Prop({ type: Date, required: true })
  endsAt!: Date;

  @Prop({ type: [String], required: false, default: [] })
  productIds?: string[];

  @Prop({ type: [String], required: false, default: [] })
  sizes?: string[];

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  @Prop({ type: Date }) createdAt?: Date;
  @Prop({ type: Date }) updatedAt?: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ createdAt: -1 });
CouponSchema.index({ code: 1 }, { unique: true });
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';
import { OrderStatus } from '../enums/order-status.enum';

export type OrderDocument = HydratedDocument<Order>;

class OrderItem {
  @Prop({ required: true }) productId!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, min: 1 }) quantity!: number;
  @Prop({ required: true, min: 0 }) unitPrice!: number;
  @Prop() size?: string;
}

class StatusHistory {
  @Prop({ required: true, enum: Object.values(OrderStatus) }) status!: OrderStatus;
  @Prop({ required: true }) at!: Date;
  @Prop() note?: string;
  @Prop() changedBy?: string;
}

const options: SchemaOptions = {
  collection: 'orders',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: Record<string, any>) => {
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

@Schema(options)
export class Order {
  @Prop({ required: true }) id!: string;                      // uuid
  @Prop({ unique: true, sparse: true }) checkoutDraftId?: string;
  @Prop({ required: true, unique: true, index: true }) orderNumber!: number; // seq
  @Prop({ required: true, index: true }) customerId!: string;

  @Prop({ type: [OrderItem], default: [] }) items!: OrderItem[];

  @Prop({ required: true, enum: Object.values(OrderStatus), index: true })
  status!: OrderStatus;

  @Prop({ type: [StatusHistory], default: [] })
  statusHistory!: StatusHistory[];

  @Prop({ required: true, min: 0 }) subtotal!: number;
  @Prop({ required: true, min: 0 }) shippingTotal!: number;
  @Prop({ required: true, min: 0 }) discountTotal!: number;
  @Prop({ required: true, min: 0 }) grandTotal!: number;

  @Prop() couponCode?: string;
  @Prop() notes?: string;

  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

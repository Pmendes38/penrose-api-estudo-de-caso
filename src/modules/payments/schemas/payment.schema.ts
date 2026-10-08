import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BillingType } from '../enums/billing-type.enum';

export type PaymentDocument = HydratedDocument<Payment>;

class StatusHistory {
  @Prop({ required: true, enum: Object.values(PaymentStatus) }) 
  status!: PaymentStatus;
  
  @Prop({ required: true }) 
  at!: Date;
  
  @Prop() 
  note?: string;
}

const options: SchemaOptions = {
  collection: 'payments',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: Record<string, any>) => { delete ret._id; return ret; },
  },
};

@Schema(options)
export class Payment {
  @Prop({ required: true, unique: true }) 
  id!: string; // uuid
  
  @Prop({ required: true, index: true }) 
  orderId!: string;
  
  @Prop({ required: true, enum: Object.values(BillingType) }) 
  billingType!: BillingType;
  
  @Prop({ required: true, enum: Object.values(PaymentStatus), index: true }) 
  status!: PaymentStatus;
  
  @Prop({ required: true, min: 0 }) 
  amount!: number;

  @Prop({ default: 'ASAAS' }) 
  provider!: 'ASAAS' | 'DEMO';
  
  @Prop({ index: true }) 
  providerPaymentId?: string;

  @Prop() 
  boletoUrl?: string;

  @Prop() 
  identificatorField?: string;

  @Prop() 
  pixPayload?: string;

  @Prop({ type: [StatusHistory], default: [] }) 
  statusHistory!: StatusHistory[];

  @Prop() 
  createdAt?: Date;

  @Prop() 
  updatedAt?: Date;
}
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ orderId: 1, createdAt: -1 });

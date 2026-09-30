import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

@Schema({ timestamps: true, collection: 'checkout_drafts' })
export class CheckoutDraft {
  @Prop({ type: String, default: () => randomUUID(), index: true, unique: true })
  id: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Cart', index: true, required: true })
  cartId: any;

  @Prop({ type: String, index: true })
  customerId?: string;

  @Prop({ type: Number, required: true })
  cartVersion: number;

  @Prop({ type: Array, default: [] })
  items: any[];

  @Prop({ type: Array, default: [] })
  coupons: string[];

  @Prop({ type: Object })
  shipping?: any;

  @Prop({ type: Object })
  shippingAddress?: Record<string, any>;

  @Prop({
    type: Object,
    required: true,
  })
  totals: {
    itemsSubtotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    grandTotal: number;
  };

  @Prop({ type: String, enum: ['open', 'completed', 'expired', 'abandoned'], default: 'open', index: true })
  status: 'open' | 'completed' | 'expired' | 'abandoned';

  @Prop({ type: String, index: true })
  idempotencyKey?: string;

  @Prop({ type: Date, index: { expires: 0 } })
  expiresAt: Date;

  @Prop({ type: Object })
  integration?: {
    provider?: 'melhor-envio';
    melhorEnvio?: {
      orders?: string[];               // IDs das orders no ME
      print?: { mode: 'public' | 'private'; url: string };
      previewUrl?: string;
      cartPayload?: any;               // payload enviado ao /me/cart
      lastResponse?: any;              // último corpo de retorno da API
      status?: 'carted' | 'checked_out' | 'generated' | 'printed';
    };
  };
}

export type CheckoutDraftDocument = HydratedDocument<CheckoutDraft>;
export const CheckoutDraftSchema = SchemaFactory.createForClass(CheckoutDraft);

CheckoutDraftSchema.set('toJSON', {
  transform: (_: any, ret: any) => {
    ret._id = undefined;
    ret.__v = undefined;
    return ret;
  },
});

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class CartItemDiscount {
  @Prop()
  source: string;

  @Prop({ required: true })
  amount: number;
}
const CartItemDiscountSchema = SchemaFactory.createForClass(CartItemDiscount);

@Schema({ _id: false })
export class CartItemDimensions {
  @Prop()
  lengthCm?: number;

  @Prop()
  widthCm?: number;

  @Prop()
  heightCm?: number;
}
const CartItemDimensionsSchema = SchemaFactory.createForClass(CartItemDimensions);

@Schema({ _id: false })
export class CartItem {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  sku: string;

  @Prop()
  productId?: string;

  @Prop()
  name?: string;

  @Prop()
  image?: string;

  @Prop({ type: Object })
  variant?: Record<string, string>;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  unitPrice: number; // centavos

  @Prop()
  listPrice?: number;

  @Prop({ type: [CartItemDiscountSchema], default: [] })
  discounts: CartItemDiscount[];

  @Prop()
  weightGrams?: number;

  @Prop({ type: CartItemDimensionsSchema })
  dimensions?: CartItemDimensions;

  @Prop({ required: true })
  total: number;
}
export type CartItemDocument = HydratedDocument<CartItem>;
export const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true })
export class Cart {
  @Prop()
  userId?: string;

  @Prop({ required: true, default: 'active', enum: ['active', 'converted', 'canceled'] })
  status: 'active' | 'converted' | 'canceled';

  @Prop({ default: 'BRL' })
  currency: string;

  @Prop({ default: 'pt-BR' })
  locale: string;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ default: 0 })
  itemsSubtotal: number; // centavos

  @Prop({ default: 0 })
  discountTotal: number; // centavos

  @Prop({ default: 0 })
  shippingTotal: number; // centavos

  @Prop({ default: 0 })
  taxTotal: number; // centavos

  @Prop({ default: 0 })
  grandTotal: number; // centavos

  @Prop({ type: [String], default: [] })
  coupons: string[];

  @Prop({ type: Object })
  shippingAddress?: Record<string, any>;

  @Prop({ type: Object })
  shippingQuotes?: { postalCode: string; expiresAt: number; quotes: any[] };

  @Prop({ type: Object })
  shipping?: {
    serviceCode: string;
    label: string;
    amount: number; // centavos
    days?: number;
    eta?: string;
    isFree?: boolean;

    // ===== Metadados do Melhor Envio (para /me/cart no checkout) =====
    provider?: 'melhor-envio';
    me?: {
      serviceId: string;           // id do serviço (ME)
      companyId?: string;          // id da transportadora (ME)
      agencyId?: string;           // se aplicável (ex.: JadLog)
      fromPostal?: string;         // CEP origem (8 dígitos)
      toPostal?: string;           // CEP destino (8 dígitos)
      options?: {
        insurance_value?: number;  // BRL
        receipt?: boolean;
        own_hand?: boolean;
        non_commercial?: boolean;
        invoice_key?: string;
        platform?: string;
        tags?: Array<{ tag: string; url?: string }>;
      };
      volumes?: Array<{
        height: number; width: number; length: number; weight: number;
      }>;
      products?: Array<{
        name: string; quantity: number; unitary_value: number; weight?: number;
      }>;
    };
  };

  @Prop({ required: true, default: 1 })
  version: number;
}
export type CartDocument = HydratedDocument<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);
CartSchema.index({ userId: 1, status: 1 });

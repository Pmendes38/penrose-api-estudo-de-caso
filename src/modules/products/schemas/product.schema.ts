import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';
import { ProductStatus } from '../enums/product-status.enum';

export type ProductDocument = HydratedDocument<Product>;

const options: SchemaOptions = {
  collection: 'products',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: Record<string, any>) => { delete ret._id; return ret; },
  },
  toObject: { virtuals: true },
};

@Schema(options)
export class Product {
  @Prop({ required: true }) 
  id!: string;
  
  @Prop({ required: true, trim: true, index: true }) 
  name!: string;
  
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true }) 
  slug!: string;

  @Prop({ trim: true, index: true }) 
  category?: string;

  @Prop({ required: true, min: 0, index: true }) 
  priceCents!: number;
  
  @Prop({ required: true, min: 0, default: 0 }) 
  stock!: number;

  @Prop({ required: true, enum: Object.values(ProductStatus), default: ProductStatus.ACTIVE, index: true })
  status!: ProductStatus;

  @Prop() 
  description?: string;

  @Prop({ type: [String], default: [] }) 
  images!: string[];
  
  @Prop({ type: [String], default: [], index: true }) 
  tags!: string[];

  @Prop({ unique: true, sparse: true, trim: true, uppercase: true }) 
  sku?: string;

  @Prop() createdAt?: Date;

  @Prop() updatedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ createdAt: -1 });
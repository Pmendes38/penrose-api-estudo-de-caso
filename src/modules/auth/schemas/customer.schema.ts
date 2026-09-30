import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

class Address {
  @Prop({ required: true })
  id: string;
  
  @Prop({ trim: true })
  label?: string;
  
  @Prop({ trim: true })
  personName?: string;
  
  @Prop({ trim: true })
  phone?: string;
  
  @Prop({ required: true, trim: true })
  zipCode!: string;
  
  @Prop({ required: true, trim: true })
  street!: string;
  
  @Prop({ trim: true })
  number?: string;
  
  @Prop({ trim: true })
  complement?: string;
  
  @Prop({ trim: true })
  neighborhood?: string;
  
  @Prop({ required: true, trim: true })
  city!: string;
  
  @Prop({ required: true, trim: true })
  state!: string;
  
  @Prop({ trim: true, default: 'BR' })
  country?: string;
  
  @Prop({ default: false })
  isDefault?: boolean;
  
  @Prop({ default: () => new Date() })
  createdAt?: Date;
  
  @Prop({ default: () => new Date() })
  updatedAt?: Date;
}


class Preferences {
  @Prop({ default: 'pt-BR' })
  locale?: string;
  
  @Prop({ default: 'system', enum: ['light', 'dark', 'system'] })
    theme?: 'light' | 'dark' | 'system';
  
  @Prop({ default: false })
  newsletterOptIn?: boolean;
}


const options: SchemaOptions = {
  collection: 'customers',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: unknown, ret: Record<string, unknown>) => {
      if ('passwordHash' in ret) delete (ret as any).passwordHash;
      if ('_id' in ret) delete (ret as any)._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

@Schema(options)
export class Customer {
  @Prop({ required: true })
  id!: string;
  
  @Prop({ required: true, trim: true })
  name!: string;
  
  @Prop({ required: true, lowercase: true, trim: true, index: true, unique: true })
  email!: string;
  
    @Prop({ select: false, required: true })
  passwordHash!: string;
  
  @Prop({ trim: true })
  phone?: string;


  @Prop() avatarUrl?: string;
  @Prop({ type: [Address], default: [] })
  addresses?: Address[];
  
  @Prop({ type: Preferences, default: {} })
  preferences?: Preferences;


  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ createdAt: -1 });

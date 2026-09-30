import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

const options: SchemaOptions = {
  collection: 'admins',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (_: any, ret: Record<string, any>) => {
      delete ret.passwordHash;
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

@Schema(options)
export class Admin {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true, unique: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, enum: ['admin'], default: 'admin' })
  role: 'admin';

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

AdminSchema.index({ createdAt: -1 });
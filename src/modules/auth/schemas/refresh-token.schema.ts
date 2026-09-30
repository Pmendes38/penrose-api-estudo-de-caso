import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaOptions } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

const options: SchemaOptions = {
  collection: 'refresh_tokens',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
};

@Schema(options)
export class RefreshToken {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  jti: string;

  @Prop({ required: true, select: false })
  hashedToken: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop() 
  userAgent?: string;

  @Prop() 
  ip?: string;

  @Prop() 
  lastUsedAt?: Date;

  @Prop() 
  revokedAt?: Date;


  @Prop() 
  createdAt?: Date;

  @Prop() 
  updatedAt?: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
RefreshTokenSchema.index({ userId: 1, jti: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });

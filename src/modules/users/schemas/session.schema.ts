import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  @Prop({ required: true, unique: true })
  id: string;       // jti do refresh
  
  @Prop({ required: true })
  userId: string;
  
  @Prop() 
  userAgent?: string;

  @Prop() 
  ip?: string;

  @Prop({ default: () => new Date() })
  lastUsedAt?: Date;
  
  @Prop({ default: false })
  revoked?: boolean;
  
  @Prop() 
  revokedAt?: Date;

  @Prop() 
  revokedReason?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ userId: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CounterDocument = HydratedDocument<Counter>;

@Schema({ collection: 'counters', versionKey: false })
export class Counter {
  @Prop({ required: true, unique: true }) name!: string; // e.g., 'orderNumber'
  @Prop({ required: true, default: 0 }) value!: number;
}
export const CounterSchema = SchemaFactory.createForClass(Counter);
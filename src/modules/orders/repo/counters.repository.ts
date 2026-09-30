import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Counter, CounterDocument } from '../schemas/counter.schema';
import { Model } from 'mongoose';

@Injectable()
export class CountersRepository {
  constructor(@InjectModel(Counter.name) private readonly model: Model<CounterDocument>) {}

  async next(name: string): Promise<number> {
    const res = await this.model.findOneAndUpdate(
      { name },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean().exec();
    return res!.value;
  }
}
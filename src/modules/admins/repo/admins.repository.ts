import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model } from 'mongoose';
import { Admin, AdminDocument } from '../schemas/admin.schema';

@Injectable()
export class AdminsRepository {
  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
  ) {}

  async findPaged(page: number, pageSize: number) {
    const skip = Math.max(0, (page - 1) * pageSize);

    const [items, total] = await Promise.all([
      this.adminModel
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.adminModel.countDocuments().exec(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize) || 1,
    };
  }

  findById(id: string, withPassword = false) {
    const query = this.adminModel.findOne({ id });
    if (withPassword) query.select('+passwordHash');
    return query.lean().exec();
  }

  findByEmail(email: string, withPassword = false) {
    const query = this.adminModel.findOne({ email });
    if (withPassword) query.select('+passwordHash');
    return query.lean().exec();
  }

  create(doc: Admin) {
    return this.adminModel.create(doc);
  }

  updateById(id: string, set: Partial<Admin>) {
    return this.adminModel
      .findOneAndUpdate({ id }, { $set: set }, { new: true })
      .lean()
      .exec();
  }

  async deleteById(id: string): Promise<DeleteResult> {
    return this.adminModel.deleteOne({ id }).exec();
  }
}
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../../auth/schemas/customer.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(Customer.name) private readonly model: Model<CustomerDocument>) {}

  findById(id: string) {
    return this.model.findOne({ id }).lean().exec();
  }

  async updateById(id: string, set: Partial<Customer>) {
    return this.model
      .findOneAndUpdate(
        { id },
        { $set: { ...set, updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      .lean()
      .exec();
  }

  /* -------- Endereços -------- */

  async pushAddress(userId: string, address: any) {
    return this.model
      .findOneAndUpdate(
        { id: userId },
        { $push: { addresses: address }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      .lean()
      .exec();
  }

  async updateAddressById(userId: string, addressId: string, set: Record<string, any>) {
    const prefix = 'addresses.$';
    const $set: Record<string, any> = {};
    for (const [k, v] of Object.entries(set)) {
      $set[`${prefix}.${k}`] = v;
    }
    $set[`${prefix}.updatedAt`] = new Date();

    return this.model
      .findOneAndUpdate(
        { id: userId, 'addresses.id': addressId },
        { $set },
        { returnDocument: 'after' }
      )
      .lean()
      .exec();
  }

  async pullAddress(userId: string, addressId: string) {
    return this.model
      .findOneAndUpdate(
        { id: userId },
        { $pull: { addresses: { id: addressId } }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
      )
      .lean()
      .exec();
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.model.updateOne(
      { id: userId },
      { $set: { 'addresses.$[].isDefault': false } }
    ).exec();

    return this.model
      .findOneAndUpdate(
        { id: userId, 'addresses.id': addressId },
        { $set: { 'addresses.$[elem].isDefault': true, updatedAt: new Date() } },
        { arrayFilters: [{ 'elem.id': addressId }], returnDocument: 'after' } as any
      )
      .lean()
      .exec();
  }
}

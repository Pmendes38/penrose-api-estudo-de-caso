import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, FilterQuery, Model } from 'mongoose';
import { Admin, AdminDocument } from '../../admins/schemas/admin.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(RefreshToken.name) private readonly refreshModel: Model<RefreshTokenDocument>,
  ) {}

  findAdminByEmail(email: string) {
    return this.adminModel.findOne({ email }).select('+passwordHash').lean().exec();
  }
  findCustomerByEmail(email: string) {
    return this.customerModel.findOne({ email }).select('+passwordHash').lean().exec();
  }

  findAdminById(id: string) {
    return this.adminModel.findOne({ id }).lean().exec();
  }
  findCustomerById(id: string) {
    return this.customerModel.findOne({ id }).lean().exec();
  }

  async findPrincipalById(
    userId: string,
  ): Promise<{ name: string; email: string; role: 'admin' | 'customer' } | null> {
    const admin = await this.adminModel.findOne({ id: userId }).lean().exec();
    if (admin) {
      return {
        name: (admin as any).name ?? 'Administrator',
        email: (admin as any).email,
        role: 'admin',
      };
    }
    const customer = await this.customerModel.findOne({ id: userId }).lean().exec();
    if (customer) {
      return {
        name: (customer as any).name,
        email: (customer as any).email,
        role: 'customer',
      };
    }
    return null;
  }

  async existsCustomerByEmail(email: string) {
    return !!(await this.customerModel.exists({ email }).lean());
  }

  async insertCustomer(payload: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    phone?: string | null;
    acceptTerms?: boolean;
    acceptPromotions?: boolean;
  }) {
    const created = await this.customerModel.create({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return created.toJSON();
  }

  async createSession(rec: {
    userId: string;
    jti: string;
    hashedToken: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }) {
    await this.refreshModel.create({
      ...rec,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  findSession(userId: string, jti: string) {
    return this.refreshModel
      .findOne({ userId, jti })
      .select('+hashedToken')
      .lean()
      .exec();
  }

  async touchSession(userId: string, jti: string, meta?: { userAgent?: string; ip?: string }) {
    await this.refreshModel
      .updateOne(
        { userId, jti, revokedAt: { $exists: false } as any },
        {
          $set: {
            lastUsedAt: new Date(),
            ...(meta?.ip ? { ip: meta.ip } : {}),
            ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async revokeSession(userId: string, jti: string) {
    await this.refreshModel
      .updateOne(
        { userId, jti, revokedAt: { $exists: false } as any },
        { $set: { revokedAt: new Date(), updatedAt: new Date() }, $unset: { hashedToken: 1 } },
      )
      .exec();
  }

  async revokeAllSessions(userId: string) {
    await this.refreshModel
      .updateMany(
        { userId, revokedAt: { $exists: false } as any },
        { $set: { revokedAt: new Date(), updatedAt: new Date() }, $unset: { hashedToken: 1 } },
      )
      .exec();
  }

  listSessions(userId: string) {
    const q: FilterQuery<RefreshTokenDocument> = { userId, revokedAt: { $exists: false } as any };
    return this.refreshModel.find(q).sort({ updatedAt: -1 }).lean().exec();
  }

  async upsertRefreshToken(userId: string, jti: string, hashedToken: string, expiresAtISO: string) {
    await this.refreshModel
      .updateOne(
        { userId, jti },
        {
          $set: {
            userId,
            jti,
            hashedToken,
            expiresAt: new Date(expiresAtISO),
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      )
      .exec();
  }

  findRefreshToken(userId: string, jti: string) {
    return this.findSession(userId, jti);
  }

  revokeRefreshToken(userId: string, jti: string): Promise<DeleteResult> {
    return this.refreshModel.deleteOne({ userId, jti }).exec();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';

@Injectable()
export class SessionsRepository {
  constructor(@InjectModel(Session.name) private readonly model: Model<SessionDocument>) {}

  findByUser(userId: string) {
    return this.model.find({ userId }).sort({ updatedAt: -1 }).lean().exec();
  }

  revoke(userId: string, sessionId: string) {
    return this.model
      .findOneAndUpdate(
        { userId, id: sessionId },
        { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'user' } },
        { new: true },
      )
      .lean()
      .exec();
  }

  revokeAll(userId: string, except?: string) {
    const filter: any = { userId };
    if (except) filter.id = { $ne: except };
    return this.model.updateMany(filter, {
      $set: { revoked: true, revokedAt: new Date(), revokedReason: 'user-all' },
    }).exec();
  }
}

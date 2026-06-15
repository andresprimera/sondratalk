import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserSession } from './schemas/user.schema';
import type { UserLanguage } from '@base-dashboard/shared';

export type AdminUserAggRow = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  timezone: string;
  city?: string;
  languages?: { code: string; fluency: string }[];
  locale?: string;
  applicationText?: string;
  hostExp: number;
  createdAt: Date;
  conversationCount: number;
};

type FacetResult = {
  data: AdminUserAggRow[];
  total: [{ n: number }];
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    timezone?: string;
  }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async countUsers(): Promise<number> {
    return this.userModel.countDocuments();
  }

  async findAllPaginatedForAdmin(
    page: number,
    limit: number,
    sortBy: 'name' | 'role' = 'name',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Promise<{ data: AdminUserAggRow[]; total: number }> {
    const skip = (page - 1) * limit;
    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const now = new Date();

    const [result] = await this.userModel.aggregate<FacetResult>([
      {
        $lookup: {
          from: 'meetings',
          let: { uid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$$uid', '$participants'] },
                    { $eq: ['$cancelled', false] },
                    { $lt: ['$expiresAt', now] },
                  ],
                },
              },
            },
            { $count: 'c' },
          ],
          as: 'convCount',
        },
      },
      {
        $addFields: {
          conversationCount: {
            $ifNull: [{ $arrayElemAt: ['$convCount.c', 0] }, 0],
          },
        },
      },
      { $sort: { [sortBy]: sortOrder } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const total = result?.total[0]?.n ?? 0;
    const data = result?.data ?? [];
    return { data, total };
  }

  async updateRole(
    userId: string,
    role: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { role }, { new: true });
  }

  async remove(userId: string): Promise<void> {
    await this.userModel.findByIdAndDelete(userId);
  }

  async findByEmailExists(email: string): Promise<boolean> {
    return this.userModel.exists({ email }).then((result) => result !== null);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async findByIds(ids: Types.ObjectId[]): Promise<UserDocument[]> {
    if (ids.length === 0) return [];
    return this.userModel.find({ _id: { $in: ids } });
  }

  async findByIdWithSessions(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+sessions');
  }

  async addSession(
    userId: string,
    session: UserSession,
    maxSessions: number,
    refreshTtlMs: number,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - refreshTtlMs);
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { sessions: { createdAt: { $lt: cutoff } } },
    });
    await this.userModel.findByIdAndUpdate(userId, {
      $push: {
        sessions: {
          $each: [session],
          $slice: -maxSessions,
        },
      },
    });
  }

  async rotateSession(
    userId: string,
    jti: string,
    hashedToken: string,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId, 'sessions.jti': jti },
      {
        $set: {
          'sessions.$.hashedToken': hashedToken,
          'sessions.$.lastUsedAt': new Date(),
        },
      },
    );
  }

  async removeSession(userId: string, jti: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { sessions: { jti } },
    });
  }

  async removeAllSessions(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { sessions: [] });
  }

  async updatePasswordResetToken(
    userId: string,
    hashedToken: string,
    expires: Date,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      hashedPasswordResetToken: hashedToken,
      passwordResetExpires: expires,
    });
  }

  async findByEmailWithResetToken(
    email: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .select('+hashedPasswordResetToken +passwordResetExpires');
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { hashedPasswordResetToken: 1, passwordResetExpires: 1 },
    });
  }

  async updatePassword(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
  }

  async updateProfile(
    userId: string,
    data: { name: string; email: string },
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, data, { new: true });
  }

  async updateTimezone(
    userId: string,
    timezone: string,
    city?: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { timezone, ...(city !== undefined && { city }) },
      { new: true },
    );
  }

  async updateLanguages(
    userId: string,
    languages: UserLanguage[],
    locale: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { languages, locale },
      { new: true },
    );
  }

  async updateApplication(
    userId: string,
    applicationText: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { applicationText },
      { new: true },
    );
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+password');
  }

  async filterByHasHostExp(
    candidateIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    if (candidateIds.length === 0) return [];
    const docs = await this.userModel
      .find({ _id: { $in: candidateIds }, hostExp: { $gt: 0 } })
      .select('_id');
    return docs.map((d) => d._id);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import type { UserLanguage } from '@base-dashboard/shared';

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

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find();
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: UserDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel.find().skip(skip).limit(limit),
      this.userModel.countDocuments(),
    ]);
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

  async updateRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { hashedRefreshToken });
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+hashedRefreshToken');
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
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { timezone },
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

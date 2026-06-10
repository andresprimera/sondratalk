import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AllowlistEntry,
  AllowlistEntryDocument,
} from './schemas/allowlist-entry.schema';
import { CreateAllowlistEntryInput, UpdateAllowlistEntryInput } from './dto';

@Injectable()
export class AllowlistService {
  constructor(
    @InjectModel(AllowlistEntry.name)
    private allowlistModel: Model<AllowlistEntry>,
  ) {}

  async create(dto: CreateAllowlistEntryInput): Promise<AllowlistEntryDocument> {
    return this.allowlistModel.create(dto);
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: AllowlistEntryDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.allowlistModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.allowlistModel.countDocuments(),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<AllowlistEntryDocument | null> {
    return this.allowlistModel.findById(id);
  }

  async findByValueExists(value: string): Promise<boolean> {
    return this.allowlistModel.exists({ value }).then((r) => r !== null);
  }

  async update(
    id: string,
    dto: UpdateAllowlistEntryInput,
  ): Promise<AllowlistEntryDocument | null> {
    return this.allowlistModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async remove(id: string): Promise<void> {
    await this.allowlistModel.findByIdAndDelete(id);
  }

  // Beta signup gate. An email may register only if it matches an allowlist
  // entry exactly, or falls under an allowed "@domain" entry. An empty
  // allowlist therefore admits no one — the first-user (bootstrap admin)
  // exemption lives in AuthService.signup, keyed on there being no users yet,
  // so the gate genuinely closes once the app has any users.
  async isEmailAllowed(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const domain = normalized.slice(normalized.indexOf('@'));
    const match = await this.allowlistModel.exists({
      value: { $in: [normalized, domain] },
    });
    return match !== null;
  }
}

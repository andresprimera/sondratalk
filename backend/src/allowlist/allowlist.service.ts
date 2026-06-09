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

  // Beta signup gate. While the collection is empty the gate is disabled and
  // any email may register (this lets the bootstrap admin sign up). Once any
  // entry exists, only matching emails — or emails under an allowed "@domain"
  // entry — may register.
  async isEmailAllowed(email: string): Promise<boolean> {
    const total = await this.allowlistModel.estimatedDocumentCount();
    if (total === 0) return true;

    const normalized = email.trim().toLowerCase();
    const domain = normalized.slice(normalized.indexOf('@'));
    const match = await this.allowlistModel.exists({
      value: { $in: [normalized, domain] },
    });
    return match !== null;
  }
}

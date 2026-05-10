import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Availability,
  AvailabilityDocument,
} from './schemas/availability.schema';
import {
  type AvailabilityWindow,
  type UpdateAvailabilityInput,
} from './dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name)
    private availabilityModel: Model<Availability>,
  ) {}

  async findByUserId(userId: string): Promise<AvailabilityDocument | null> {
    return this.availabilityModel.findOne({
      userId: new Types.ObjectId(userId),
    });
  }

  async upsertByUserId(
    userId: string,
    update: UpdateAvailabilityInput,
  ): Promise<AvailabilityDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const $set: Record<string, unknown> = {};
    if (update.windows !== undefined) {
      $set.windows = dedupeWindows(update.windows);
    }
    if (update.isAvailableNow !== undefined) {
      $set.isAvailableNow = update.isAvailableNow;
    }
    const doc = await this.availabilityModel.findOneAndUpdate(
      { userId: userObjectId },
      { $set, $setOnInsert: { userId: userObjectId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (!doc) {
      // upsert:true with new:true should always return a doc; guard for type narrowing.
      throw new Error('Availability upsert returned no document');
    }
    return doc;
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.availabilityModel.deleteOne({
      userId: new Types.ObjectId(userId),
    });
  }

  async findAvailableNowUserIds(
    candidateIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    if (candidateIds.length === 0) return [];
    const docs = await this.availabilityModel
      .find({
        userId: { $in: candidateIds },
        isAvailableNow: true,
      })
      .select('userId');
    return docs.map((d) => d.userId);
  }

  async findByUserIds(
    userIds: Types.ObjectId[],
  ): Promise<AvailabilityDocument[]> {
    if (userIds.length === 0) return [];
    return this.availabilityModel.find({ userId: { $in: userIds } });
  }
}

function dedupeWindows(
  windows: AvailabilityWindow[],
): AvailabilityWindow[] {
  const seen = new Set<string>();
  const out: AvailabilityWindow[] = [];
  for (const w of windows) {
    const key = `${w.period}:${w.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

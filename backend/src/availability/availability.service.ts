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
    const $unset: Record<string, unknown> = {};
    if (update.windows !== undefined) {
      $set.windows = dedupeWindows(update.windows);
    }
    if (update.isAvailableNow !== undefined) {
      $set.isAvailableNow = update.isAvailableNow;
      if (update.isAvailableNow) {
        $set.availableNowSetAt = new Date();
      } else {
        $unset.availableNowSetAt = '';
      }
    }
    const updateDoc: Record<string, unknown> = {
      $set,
      $setOnInsert: { userId: userObjectId },
    };
    if (Object.keys($unset).length > 0) {
      updateDoc.$unset = $unset;
    }
    const doc = await this.availabilityModel.findOneAndUpdate(
      { userId: userObjectId },
      updateDoc,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (!doc) {
      // upsert:true with new:true should always return a doc; guard for type narrowing.
      throw new Error('Availability upsert returned no document');
    }
    return doc;
  }

  // Heartbeat: bumps availableNowSetAt without touching windows or flipping
  // isAvailableNow. Returns null if the row doesn't exist or isn't currently
  // online — heartbeats from a user who never went online are a no-op.
  async touchAvailableNow(
    userId: string,
  ): Promise<AvailabilityDocument | null> {
    return this.availabilityModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        isAvailableNow: true,
      },
      { $set: { availableNowSetAt: new Date() } },
      { new: true },
    );
  }

  async clearAvailableNow(userId: string): Promise<void> {
    await this.availabilityModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: { isAvailableNow: false },
        $unset: { availableNowSetAt: '' },
      },
    );
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.availabilityModel.deleteOne({
      userId: new Types.ObjectId(userId),
    });
  }

  // Live pool for the admin "Available Now" view: everyone currently online
  // with a still-fresh heartbeat, most recently active first. Paginated at the
  // presence layer so we never load the whole collection.
  async findAvailableNowPaginated(
    freshSince: Date,
    skip: number,
    limit: number,
  ): Promise<{ userIds: Types.ObjectId[]; total: number }> {
    const filter = {
      isAvailableNow: true,
      availableNowSetAt: { $gte: freshSince },
    };
    const [docs, total] = await Promise.all([
      this.availabilityModel
        .find(filter)
        // _id is the stable tiebreaker so equal timestamps order
        // deterministically across page fetches. The primary key still moves
        // as heartbeats bump availableNowSetAt — cross-page drift under live
        // presence is inherent and tolerated given the 30s client refetch.
        .sort({ availableNowSetAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .select('userId'),
      this.availabilityModel.countDocuments(filter),
    ]);
    return { userIds: docs.map((d) => d.userId), total };
  }

  async findAvailableNowUserIds(
    candidateIds: Types.ObjectId[],
    freshSince: Date,
  ): Promise<Types.ObjectId[]> {
    if (candidateIds.length === 0) return [];
    const docs = await this.availabilityModel
      .find({
        userId: { $in: candidateIds },
        isAvailableNow: true,
        availableNowSetAt: { $gte: freshSince },
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

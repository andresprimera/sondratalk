import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership } from './schemas/membership.schema';
import { CircleDocument } from '../circles/schemas/circle.schema';
import { CirclesService } from '../circles/circles.service';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectModel(Membership.name)
    private membershipModel: Model<Membership>,
    private circlesService: CirclesService,
  ) {}

  async replaceCirclesForUser(
    userId: string,
    circleIds: string[],
  ): Promise<CircleDocument[]> {
    // Dedupe — duplicate ids in the request body shouldn't surface as a
    // misleading "circle not found" error.
    const uniqueIds = [...new Set(circleIds)];
    const validCircles = await this.circlesService.findByIds(uniqueIds);
    if (validCircles.length !== uniqueIds.length) {
      throw new BadRequestException('One or more circles do not exist');
    }

    const userObjectId = new Types.ObjectId(userId);
    const existing = await this.membershipModel
      .find({ userId: userObjectId })
      .select('circleId');
    const existingIds = new Set(
      existing.map((m) => m.circleId.toString()),
    );
    const desiredIds = new Set(uniqueIds);
    const toInsert = uniqueIds.filter((id) => !existingIds.has(id));
    const toDelete = [...existingIds].filter((id) => !desiredIds.has(id));

    if (toInsert.length || toDelete.length) {
      await this.membershipModel.bulkWrite(
        [
          ...(toDelete.length
            ? [
                {
                  deleteMany: {
                    filter: {
                      userId: userObjectId,
                      circleId: {
                        $in: toDelete.map((id) => new Types.ObjectId(id)),
                      },
                    },
                  },
                },
              ]
            : []),
          ...toInsert.map((circleId) => ({
            insertOne: {
              document: {
                userId: userObjectId,
                circleId: new Types.ObjectId(circleId),
              },
            },
          })),
        ],
        { ordered: false },
      );
    }

    return validCircles;
  }

  async findCirclesForUser(userId: string): Promise<CircleDocument[]> {
    const memberships = await this.membershipModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate<{ circleId: CircleDocument }>('circleId');
    return memberships
      .map((m) => m.circleId)
      .filter((c): c is CircleDocument => c !== null && c !== undefined);
  }

  async findCircleIdsForUser(userId: string): Promise<Types.ObjectId[]> {
    const memberships = await this.membershipModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('circleId');
    return memberships.map((m) => m.circleId);
  }

  async findOtherUserIdsInCircles(
    circleIds: Types.ObjectId[],
    excludeUserId: string,
  ): Promise<Types.ObjectId[]> {
    const ids = await this.membershipModel.distinct('userId', {
      circleId: { $in: circleIds },
      userId: { $ne: new Types.ObjectId(excludeUserId) },
    });
    // Mongoose distinct() returns the field's underlying type (ObjectId) but is typed as unknown[].
    // eslint-disable-next-line no-restricted-syntax
    return ids as Types.ObjectId[];
  }

  async findCircleMembershipsForUsers(
    userIds: Types.ObjectId[],
    withinCircleIds: Types.ObjectId[],
  ): Promise<Map<string, Types.ObjectId[]>> {
    const out = new Map<string, Types.ObjectId[]>();
    if (userIds.length === 0 || withinCircleIds.length === 0) return out;
    const docs = await this.membershipModel
      .find({
        userId: { $in: userIds },
        circleId: { $in: withinCircleIds },
      })
      .select('userId circleId');
    for (const doc of docs) {
      const key = doc.userId.toString();
      const list = out.get(key) ?? [];
      list.push(doc.circleId);
      out.set(key, list);
    }
    return out;
  }
}

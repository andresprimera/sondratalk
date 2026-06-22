import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MatchExclusion } from './schemas/match-exclusion.schema';

@Injectable()
export class MatchExclusionsService {
  private readonly logger = new Logger(MatchExclusionsService.name);

  constructor(
    @InjectModel(MatchExclusion.name)
    private matchExclusionModel: Model<MatchExclusion>,
  ) {}

  async create(fromUserId: string, toUserId: string): Promise<void> {
    await this.matchExclusionModel.findOneAndUpdate(
      {
        fromUserId: new Types.ObjectId(fromUserId),
        toUserId: new Types.ObjectId(toUserId),
      },
      {},
      { upsert: true, setDefaultsOnInsert: true },
    );
    this.logger.log(`User ${fromUserId} excluded ${toUserId} from matching`);
  }

  async findExcludedUserIds(fromUserId: string): Promise<Types.ObjectId[]> {
    const docs = await this.matchExclusionModel
      .find({ fromUserId: new Types.ObjectId(fromUserId) })
      .select('toUserId');
    return docs.map((doc) => doc.toUserId);
  }
}

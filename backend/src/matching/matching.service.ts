import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MatchAttempt,
  MatchAttemptDocument,
} from './schemas/match-attempt.schema';
import { MembershipsService } from '../memberships/memberships.service';
import { AvailabilityService } from '../availability/availability.service';
import { UsersService } from '../users/users.service';
import { CirclesService } from '../circles/circles.service';
import { toCircle } from '../circles/circle.mapper';
import type { HeardMatch, TalkMatch } from './dto';

type Intent = 'talk' | 'heard';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectModel(MatchAttempt.name)
    private matchAttemptModel: Model<MatchAttempt>,
    private membershipsService: MembershipsService,
    private availabilityService: AvailabilityService,
    private usersService: UsersService,
    private circlesService: CirclesService,
  ) {}

  async findTalkMatch(
    userId: string,
    circleIds: string[],
  ): Promise<TalkMatch> {
    const requestedCircleIds = await this.authorizeCircleFilter(
      userId,
      circleIds,
    );
    const availableUserIds = await this.findAvailableCandidates(
      userId,
      requestedCircleIds,
    );
    if (availableUserIds.length === 0) {
      await this.logAttempt(userId, requestedCircleIds, null, 'talk');
      throw new NotFoundException('No one available right now');
    }
    return this.pickAndShape(
      availableUserIds,
      userId,
      requestedCircleIds,
      'talk',
      (user, sharedCircles) => ({
        id: user.id,
        firstName: extractFirstName(user.name),
        sharedCircles,
      }),
    );
  }

  async findHeardMatch(
    userId: string,
    circleIds: string[],
  ): Promise<HeardMatch> {
    const requestedCircleIds = await this.authorizeCircleFilter(
      userId,
      circleIds,
    );
    const availableUserIds = await this.findAvailableCandidates(
      userId,
      requestedCircleIds,
    );
    const hostUserIds =
      await this.usersService.filterByHasHostExp(availableUserIds);
    if (hostUserIds.length === 0) {
      await this.logAttempt(userId, requestedCircleIds, null, 'heard');
      throw new NotFoundException('No experienced listeners available right now');
    }
    return this.pickAndShape(
      hostUserIds,
      userId,
      requestedCircleIds,
      'heard',
      (user, sharedCircles) => ({
        id: user.id,
        firstName: extractFirstName(user.name),
        hostExp: user.hostExp,
        sharedCircles,
      }),
    );
  }

  private async authorizeCircleFilter(
    userId: string,
    circleIds: string[],
  ): Promise<Types.ObjectId[]> {
    const requestedCircleIds = circleIds.map((id) => new Types.ObjectId(id));
    const myCircleIds = await this.membershipsService.findCircleIdsForUser(
      userId,
    );
    const myCircleIdSet = new Set(myCircleIds.map((id) => id.toString()));
    const allBelongToRequester = requestedCircleIds.every((id) =>
      myCircleIdSet.has(id.toString()),
    );
    if (!allBelongToRequester) {
      throw new BadRequestException('Invalid circle selection');
    }
    return requestedCircleIds;
  }

  private async findAvailableCandidates(
    userId: string,
    requestedCircleIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    const candidateUserIds =
      await this.membershipsService.findOtherUserIdsInCircles(
        requestedCircleIds,
        userId,
      );
    return this.availabilityService.findAvailableNowUserIds(candidateUserIds);
  }

  private async pickAndShape<T>(
    eligibleUserIds: Types.ObjectId[],
    requesterId: string,
    requestedCircleIds: Types.ObjectId[],
    intent: Intent,
    shape: (
      user: { id: string; name: string; hostExp: number },
      sharedCircles: ReturnType<typeof toCircle>[],
    ) => T,
  ): Promise<T> {
    const pickedUserId =
      eligibleUserIds[Math.floor(Math.random() * eligibleUserIds.length)];

    const [pickedUser, pickedCircleIds] = await Promise.all([
      this.usersService.findById(pickedUserId.toString()),
      this.membershipsService.findCircleIdsForUser(pickedUserId.toString()),
    ]);

    if (!pickedUser) {
      // Picked user disappeared between queries — treat as no match.
      await this.logAttempt(requesterId, requestedCircleIds, null, intent);
      throw new NotFoundException('No one available right now');
    }

    const pickedCircleIdSet = new Set(
      pickedCircleIds.map((id) => id.toString()),
    );
    const sharedCircleIds = requestedCircleIds.filter((id) =>
      pickedCircleIdSet.has(id.toString()),
    );
    const sharedCircleDocs = await this.circlesService.findByIds(
      sharedCircleIds.map((id) => id.toString()),
    );

    await this.logAttempt(
      requesterId,
      requestedCircleIds,
      pickedUserId,
      intent,
    );

    return shape(
      {
        id: pickedUser.id,
        name: pickedUser.name,
        hostExp: pickedUser.hostExp ?? 0,
      },
      sharedCircleDocs.map(toCircle),
    );
  }

  private async logAttempt(
    userId: string,
    circleIds: Types.ObjectId[],
    matchedUserId: Types.ObjectId | null,
    intent: Intent,
  ): Promise<MatchAttemptDocument | null> {
    try {
      return await this.matchAttemptModel.create({
        userId: new Types.ObjectId(userId),
        intent,
        circleIds,
        matchedUserId,
      });
    } catch (err) {
      this.logger.error('Failed to log match attempt', err);
      return null;
    }
  }
}

function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  const first = trimmed.split(/\s+/)[0];
  return first || fullName;
}

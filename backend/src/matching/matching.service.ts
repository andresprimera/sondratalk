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
import { MeetingsService } from '../meetings/meetings.service';
import { MatchExclusionsService } from '../match-exclusions/match-exclusions.service';
import { CircleDocument } from '../circles/schemas/circle.schema';
import { toCircle } from '../circles/circle.mapper';
import type {
  HeardCandidate,
  HeardMatchesResponse,
  MatchCandidate,
  ProjectedSlot,
  TalkMatchesResponse,
} from './dto';
import type { AvailabilityWindow } from '@base-dashboard/shared';
import { projectSlotsForCandidate } from './slot-projection';

type Intent = 'talk' | 'heard';

const MAX_CANDIDATES = 5;

// A user counts as "available now" only if their last heartbeat (or initial
// flip-on) landed within this window. The frontend pings every ~60s, so two
// minutes gives one missed beat of slack before we drop them from matching.
const PRESENCE_FRESH_MS = 2 * 60 * 1000;

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
    private meetingsService: MeetingsService,
    private matchExclusionsService: MatchExclusionsService,
  ) {}

  async findTalkMatch(
    userId: string,
    circleIds: string[],
  ): Promise<TalkMatchesResponse> {
    const candidates = await this.collectCandidates(userId, circleIds, 'talk');
    return { candidates };
  }

  async findHeardMatch(
    userId: string,
    circleIds: string[],
  ): Promise<HeardMatchesResponse> {
    const base = await this.collectCandidates(userId, circleIds, 'heard');
    const candidates: HeardCandidate[] = await this.attachHostExp(base);
    return { candidates };
  }

  private async collectCandidates(
    userId: string,
    circleIds: string[],
    intent: Intent,
  ): Promise<MatchCandidate[]> {
    const requestedCircleIds = await this.authorizeCircleFilter(
      userId,
      circleIds,
    );
    const requester = await this.usersService.findById(userId);
    if (!requester) throw new NotFoundException('User not found');

    const rawCandidateUserIds =
      await this.membershipsService.findOtherUserIdsInCircles(
        requestedCircleIds,
        userId,
      );
    // One-directional: people the requester chose not to be matched with
    // again never resurface in their own searches.
    const excludedUserIds =
      await this.matchExclusionsService.findExcludedUserIds(userId);
    const candidateUserIds = subtract(rawCandidateUserIds, excludedUserIds);

    const freshSince = new Date(Date.now() - PRESENCE_FRESH_MS);
    let nowEligible = await this.availabilityService.findAvailableNowUserIds(
      candidateUserIds,
      freshSince,
    );
    let scheduledEligible = subtract(candidateUserIds, nowEligible);

    if (intent === 'heard') {
      [nowEligible, scheduledEligible] = await Promise.all([
        this.usersService.filterByHasHostExp(nowEligible),
        this.usersService.filterByHasHostExp(scheduledEligible),
      ]);
    }

    // Rank the available-now bucket by how many of the requested circles each
    // candidate shares with the requester (most in common first). Shuffle
    // first so equal-affinity ties stay fair — V8's sort is stable, so the
    // randomized order survives within each shared-count group.
    const nowSharedCircles =
      await this.membershipsService.findCircleMembershipsForUsers(
        nowEligible,
        requestedCircleIds,
      );
    const nowPicked = this.shuffle(nowEligible)
      .sort(
        (a, b) =>
          (nowSharedCircles.get(b.toString())?.length ?? 0) -
          (nowSharedCircles.get(a.toString())?.length ?? 0),
      )
      .slice(0, MAX_CANDIDATES);
    const scheduledBudget = MAX_CANDIDATES - nowPicked.length;
    const scheduledPicked =
      scheduledBudget > 0
        ? this.shuffle(scheduledEligible).slice(0, scheduledBudget * 2)
        : [];

    const allPickedIds = [...nowPicked, ...scheduledPicked];
    if (allPickedIds.length === 0) {
      await this.logAttempt(userId, requestedCircleIds, [], intent);
      throw new NotFoundException('No one available right now');
    }

    const [users, availabilities, scheduledSharedCircles, revealedIds] =
      await Promise.all([
        this.usersService.findByIds(allPickedIds),
        this.availabilityService.findByUserIds(scheduledPicked),
        this.membershipsService.findCircleMembershipsForUsers(
          scheduledPicked,
          requestedCircleIds,
        ),
        this.findRevealedCandidateIds(userId, allPickedIds),
      ]);
    // The now-bucket memberships were already fetched for ranking; merge them
    // with the scheduled-bucket memberships. The two id sets are disjoint.
    const sharedCirclesByUser = new Map<string, Types.ObjectId[]>([
      ...nowSharedCircles,
      ...scheduledSharedCircles,
    ]);

    const usersById = new Map(users.map((u) => [u.id.toString(), u]));
    const availabilityByUser = new Map(
      availabilities.map((a) => [a.userId.toString(), a]),
    );

    const allSharedCircleIds = new Set<string>();
    for (const list of sharedCirclesByUser.values()) {
      for (const id of list) allSharedCircleIds.add(id.toString());
    }
    const sharedCircleDocs = await this.circlesService.findByIds([
      ...allSharedCircleIds,
    ]);
    const circleById = new Map(
      sharedCircleDocs.map((c) => [c.id.toString(), c]),
    );

    const now = new Date();
    const candidates: MatchCandidate[] = [];

    for (const id of nowPicked) {
      const user = usersById.get(id.toString());
      if (!user) continue;
      candidates.push({
        id: user.id,
        firstName: revealedIds.has(id.toString())
          ? extractFirstName(user.name)
          : '',
        sharedCircles: this.shapeSharedCircles(
          sharedCirclesByUser.get(id.toString()) ?? [],
          circleById,
        ),
        availableNow: true,
        slots: [],
      });
    }

    for (const id of scheduledPicked) {
      if (candidates.length >= MAX_CANDIDATES) break;
      const user = usersById.get(id.toString());
      if (!user) continue;
      const availability = availabilityByUser.get(id.toString());
      if (!availability || availability.windows.length === 0) continue;
      const slots = projectSlotsForCandidate({
        // Mongoose stores period/day as `string`; the schema enum keeps values aligned with shared.
        // eslint-disable-next-line no-restricted-syntax
        windows: availability.windows as AvailabilityWindow[],
        candidateTz: user.timezone,
        requesterTz: requester.timezone,
        now,
      });
      if (slots.length === 0) continue;
      candidates.push({
        id: user.id,
        firstName: revealedIds.has(id.toString())
          ? extractFirstName(user.name)
          : '',
        sharedCircles: this.shapeSharedCircles(
          sharedCirclesByUser.get(id.toString()) ?? [],
          circleById,
        ),
        availableNow: false,
        slots: slots.map(toProjectedSlot),
      });
    }

    if (candidates.length === 0) {
      await this.logAttempt(userId, requestedCircleIds, [], intent);
      throw new NotFoundException('No one available right now');
    }

    await this.logAttempt(
      userId,
      requestedCircleIds,
      candidates.map((c) => new Types.ObjectId(c.id)),
      intent,
    );
    return candidates;
  }

  private async attachHostExp(
    base: MatchCandidate[],
  ): Promise<HeardCandidate[]> {
    if (base.length === 0) return [];
    const ids = base.map((c) => new Types.ObjectId(c.id));
    const users = await this.usersService.findByIds(ids);
    const expById = new Map(
      users.map((u) => [u.id.toString(), u.hostExp ?? 0]),
    );
    return base.map((c) => ({ ...c, hostExp: expById.get(c.id) ?? 0 }));
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

  // Matches show no name by default — even on a rematch. The exception is a
  // past mutual door-open (see MeetingsService.hasMutualDoorOpen).
  private async findRevealedCandidateIds(
    userId: string,
    candidateIds: Types.ObjectId[],
  ): Promise<Set<string>> {
    const results = await Promise.all(
      candidateIds.map(async (id) => ({
        id: id.toString(),
        revealed: await this.meetingsService.hasMutualDoorOpen(
          userId,
          id.toString(),
        ),
      })),
    );
    return new Set(results.filter((r) => r.revealed).map((r) => r.id));
  }

  private shapeSharedCircles(
    sharedIds: Types.ObjectId[],
    circleById: Map<string, CircleDocument>,
  ): ReturnType<typeof toCircle>[] {
    const out: ReturnType<typeof toCircle>[] = [];
    for (const id of sharedIds) {
      const doc = circleById.get(id.toString());
      if (doc) out.push(toCircle(doc));
    }
    return out;
  }

  // Extracted so tests can spy on it for deterministic ordering.
  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private async logAttempt(
    userId: string,
    circleIds: Types.ObjectId[],
    matchedUserIds: Types.ObjectId[],
    intent: Intent,
  ): Promise<MatchAttemptDocument | null> {
    try {
      return await this.matchAttemptModel.create({
        userId: new Types.ObjectId(userId),
        intent,
        circleIds,
        matchedUserId: matchedUserIds[0] ?? null,
        matchedUserIds,
      });
    } catch (err) {
      this.logger.error('Failed to log match attempt', err);
      return null;
    }
  }
}

function subtract(
  all: Types.ObjectId[],
  remove: Types.ObjectId[],
): Types.ObjectId[] {
  if (remove.length === 0) return all;
  const removeSet = new Set(remove.map((id) => id.toString()));
  return all.filter((id) => !removeSet.has(id.toString()));
}

function toProjectedSlot(slot: {
  startsAt: string;
  requesterDate: string;
  requesterTime: string;
}): ProjectedSlot {
  return {
    startsAt: slot.startsAt,
    requesterDate: slot.requesterDate,
    requesterTime: slot.requesterTime,
  };
}

function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  const first = trimmed.split(/\s+/)[0];
  return first || fullName;
}

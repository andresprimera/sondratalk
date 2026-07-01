import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MatchingService } from './matching.service';
import { MatchAttempt } from './schemas/match-attempt.schema';
import { MembershipsService } from '../memberships/memberships.service';
import { AvailabilityService } from '../availability/availability.service';
import { UsersService } from '../users/users.service';
import { CirclesService } from '../circles/circles.service';
import { MeetingsService } from '../meetings/meetings.service';
import { MatchExclusionsService } from '../match-exclusions/match-exclusions.service';

describe('MatchingService', () => {
  let service: MatchingService;
  let matchAttemptModel: Record<string, jest.Mock>;
  let membershipsService: Record<string, jest.Mock>;
  let availabilityService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let circlesService: Record<string, jest.Mock>;
  let meetingsService: Record<string, jest.Mock>;
  let matchExclusionsService: Record<string, jest.Mock>;

  const requesterId = '507f1f77bcf86cd799439011';
  const requesterDoc = {
    id: requesterId,
    name: 'Requester',
    timezone: 'America/New_York',
  };
  const liveUserId = '507f1f77bcf86cd799439022';
  const scheduledUserId = '507f1f77bcf86cd799439033';
  const circleA = new Types.ObjectId('507f1f77bcf86cd799439aaa');
  const circleB = new Types.ObjectId('507f1f77bcf86cd799439bbb');

  beforeEach(async () => {
    matchAttemptModel = { create: jest.fn().mockResolvedValue({}) };
    membershipsService = {
      findCircleIdsForUser: jest.fn(),
      findOtherUserIdsInCircles: jest.fn(),
      findCircleMembershipsForUsers: jest.fn().mockResolvedValue(new Map()),
    };
    availabilityService = {
      findAvailableNowUserIds: jest.fn().mockResolvedValue([]),
      findByUserIds: jest.fn().mockResolvedValue([]),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue(requesterDoc),
      findByIds: jest.fn().mockResolvedValue([]),
      filterByHasHostExp: jest.fn(),
    };
    circlesService = { findByIds: jest.fn().mockResolvedValue([]) };
    meetingsService = {
      hasMutualDoorOpen: jest.fn().mockResolvedValue(false),
      countConversationsForUsers: jest.fn().mockResolvedValue(new Map()),
    };
    matchExclusionsService = {
      findExcludedUserIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: getModelToken(MatchAttempt.name),
          useValue: matchAttemptModel,
        },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: UsersService, useValue: usersService },
        { provide: CirclesService, useValue: circlesService },
        { provide: MeetingsService, useValue: meetingsService },
        { provide: MatchExclusionsService, useValue: matchExclusionsService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findTalkMatch', () => {
    it('returns one available-now candidate with empty slots', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([liveOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.findByIds.mockResolvedValue([
        { id: liveUserId, name: 'Ana María', timezone: 'Europe/Madrid' },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([[liveUserId, [circleA]]]),
      );
      meetingsService.countConversationsForUsers.mockResolvedValue(
        new Map([[liveUserId, 7]]),
      );
      circlesService.findByIds.mockResolvedValue([
        {
          id: circleA.toString(),
          slug: 'catalan',
          themeId: new Types.ObjectId(),
          type: 'who-you-are',
          labels: { en: 'Catalan', es: 'Catalán' },
          aliases: { en: [], es: [] },
          popularity: 0,
          isPrivate: false,
        },
      ]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.candidates).toHaveLength(1);
      const [first] = result.candidates;
      expect(first.conversationCount).toBe(7);
      expect(first.id).toBe(liveUserId);
      // Anonymous by default — no mutual door-open on record for this pair.
      expect(first.firstName).toBe('');
      expect(first.availableNow).toBe(true);
      expect(first.slots).toEqual([]);
      expect(first.sharedCircles).toHaveLength(1);
      expect(first.sharedCircles[0].slug).toBe('catalan');

      expect(matchAttemptModel.create).toHaveBeenCalledTimes(1);
      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.intent).toBe('talk');
      expect(logged.matchedUserId.toString()).toBe(liveUserId);
      expect(logged.matchedUserIds).toHaveLength(1);

      // The matching service must pass a freshness window so stale
      // "Go online" toggles don't keep appearing in match results.
      expect(availabilityService.findAvailableNowUserIds).toHaveBeenCalledTimes(
        1,
      );
      const [, freshSince] =
        availabilityService.findAvailableNowUserIds.mock.calls[0];
      expect(freshSince).toBeInstanceOf(Date);
      const ageMs = Date.now() - (freshSince as Date).getTime();
      // 2-minute TTL: tolerate small clock drift between assertion and call.
      expect(ageMs).toBeGreaterThanOrEqual(2 * 60 * 1000 - 1_000);
      expect(ageMs).toBeLessThanOrEqual(2 * 60 * 1000 + 1_000);
    });

    it('orders available-now candidates by shared-circle count, descending', async () => {
      const oneShareId = '507f1f77bcf86cd799439044';
      const twoShareId = '507f1f77bcf86cd799439055';
      const oneShareOid = new Types.ObjectId(oneShareId);
      const twoShareOid = new Types.ObjectId(twoShareId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([
        circleA,
        circleB,
      ]);
      // Listed least-shared-first to prove the service re-orders by affinity.
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        oneShareOid,
        twoShareOid,
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        oneShareOid,
        twoShareOid,
      ]);
      usersService.findByIds.mockResolvedValue([
        { id: oneShareId, name: 'Uno', timezone: 'Europe/Madrid' },
        { id: twoShareId, name: 'Dos', timezone: 'Europe/Madrid' },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([
          [oneShareId, [circleA]],
          [twoShareId, [circleA, circleB]],
        ]),
      );
      circlesService.findByIds.mockResolvedValue([
        {
          id: circleA.toString(),
          slug: 'catalan',
          themeId: new Types.ObjectId(),
          type: 'who-you-are',
          labels: { en: 'Catalan', es: 'Catalán' },
          aliases: { en: [], es: [] },
          popularity: 0,
          isPrivate: false,
        },
        {
          id: circleB.toString(),
          slug: 'hiking',
          themeId: new Types.ObjectId(),
          type: 'what-you-love',
          labels: { en: 'Hiking', es: 'Senderismo' },
          aliases: { en: [], es: [] },
          popularity: 0,
          isPrivate: false,
        },
      ]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
        circleB.toString(),
      ]);

      expect(result.candidates.map((c) => c.id)).toEqual([
        twoShareId,
        oneShareId,
      ]);
      expect(result.candidates[0].sharedCircles).toHaveLength(2);
      expect(result.candidates[1].sharedCircles).toHaveLength(1);
    });

    it('mixes available-now first then scheduled candidates with projected slots', async () => {
      // Pin to a Monday so the Tuesday-morning window below always projects
      // a future slot within the 7-day horizon, regardless of when CI runs.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-02T12:00:00Z'));
      try {
      const liveOid = new Types.ObjectId(liveUserId);
      const scheduledOid = new Types.ObjectId(scheduledUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        liveOid,
        scheduledOid,
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.findByIds.mockResolvedValue([
        { id: liveUserId, name: 'Ana', timezone: 'Europe/Madrid' },
        { id: scheduledUserId, name: 'Bea', timezone: 'Europe/Madrid' },
      ]);
      availabilityService.findByUserIds.mockResolvedValue([
        {
          userId: scheduledOid,
          windows: [{ day: 'tue', period: 'morning' }],
          isAvailableNow: false,
        },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([
          [liveUserId, [circleA]],
          [scheduledUserId, [circleA]],
        ]),
      );
      circlesService.findByIds.mockResolvedValue([
        {
          id: circleA.toString(),
          slug: 'catalan',
          themeId: new Types.ObjectId(),
          type: 'who-you-are',
          labels: { en: 'Catalan', es: 'Catalán' },
          aliases: { en: [], es: [] },
          popularity: 0,
          isPrivate: false,
        },
      ]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].availableNow).toBe(true);
      expect(result.candidates[0].slots).toEqual([]);
      expect(result.candidates[1].availableNow).toBe(false);
      expect(result.candidates[1].slots.length).toBeGreaterThan(0);
      const slot = result.candidates[1].slots[0];
      expect(slot.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(slot.requesterDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(slot.requesterTime).toMatch(/^\d{2}:\d{2}$/);
      } finally {
        jest.useRealTimers();
      }
    });

    it('drops scheduled candidates whose windows yield no future slots', async () => {
      const scheduledOid = new Types.ObjectId(scheduledUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        scheduledOid,
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([]);
      usersService.findByIds.mockResolvedValue([
        { id: scheduledUserId, name: 'Bea', timezone: 'Europe/Madrid' },
      ]);
      availabilityService.findByUserIds.mockResolvedValue([
        {
          userId: scheduledOid,
          windows: [],
          isAvailableNow: false,
        },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([[scheduledUserId, [circleA]]]),
      );

      await expect(
        service.findTalkMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects circle ids the requester is not a member of', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);

      await expect(
        service.findTalkMatch(requesterId, [
          circleA.toString(),
          circleB.toString(),
        ]),
      ).rejects.toThrow(BadRequestException);

      expect(matchAttemptModel.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException and logs an empty match when no candidates exist', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([]);

      await expect(
        service.findTalkMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      expect(matchAttemptModel.create).toHaveBeenCalledTimes(1);
      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.matchedUserId).toBeNull();
      expect(logged.matchedUserIds).toEqual([]);
    });

    it('does not throw when logging the attempt fails', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([liveOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.findByIds.mockResolvedValue([
        { id: liveUserId, name: 'Ana', timezone: 'Europe/Madrid' },
      ]);
      matchAttemptModel.create.mockRejectedValue(new Error('db down'));

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.candidates[0].id).toBe(liveUserId);
    });

    it('reveals the real first name when the pair has a mutual door-open', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([liveOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.findByIds.mockResolvedValue([
        { id: liveUserId, name: 'Ana María', timezone: 'Europe/Madrid' },
      ]);
      meetingsService.hasMutualDoorOpen.mockResolvedValue(true);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(meetingsService.hasMutualDoorOpen).toHaveBeenCalledWith(
        requesterId,
        liveUserId,
      );
      expect(result.candidates[0].firstName).toBe('Ana');
    });

    it('excludes users the requester has marked "don\'t match again"', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      const excludedOid = new Types.ObjectId(scheduledUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        liveOid,
        excludedOid,
      ]);
      matchExclusionsService.findExcludedUserIds.mockResolvedValue([
        excludedOid,
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.findByIds.mockResolvedValue([
        { id: liveUserId, name: 'Ana', timezone: 'Europe/Madrid' },
      ]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(liveUserId);
      // Only the non-excluded id should ever reach availability lookup.
      expect(
        availabilityService.findAvailableNowUserIds,
      ).toHaveBeenCalledWith([liveOid], expect.any(Date));
    });
  });

  describe('private circle gating', () => {
    const privateCircleId = new Types.ObjectId('507f1f77bcf86cd799439ccc');
    const publicCircleId = new Types.ObjectId('507f1f77bcf86cd799439ddd');
    const privateUserId = '507f1f77bcf86cd799439066';
    const publicOnlyUserId = '507f1f77bcf86cd799439077';

    it('when a private circle is selected, only returns candidates in that private circle', async () => {
      const privateOid = new Types.ObjectId(privateUserId);
      // requester belongs to both a private and a public circle
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([
        privateCircleId,
        publicCircleId,
      ]);
      // circlesService.findByIds is called once: gating check + display reuse same result
      circlesService.findByIds.mockResolvedValue([
        { id: privateCircleId.toString(), slug: 'vip-group', isPrivate: true, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'VIP', es: 'VIP' }, aliases: { en: [], es: [] }, popularity: 0 },
        { id: publicCircleId.toString(), slug: 'cooking', isPrivate: false, themeId: new Types.ObjectId(), type: 'what-you-love', labels: { en: 'Cooking', es: 'Cocina' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      // only privateUserId is in the private circle
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([privateOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([privateOid]);
      usersService.findByIds.mockResolvedValue([
        { id: privateUserId, name: 'Vip User', timezone: 'Europe/Madrid' },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([[privateUserId, [privateCircleId]]]),
      );

      const result = await service.findTalkMatch(requesterId, [
        privateCircleId.toString(),
        publicCircleId.toString(),
      ]);

      // Only users from the private circle pool should be candidates
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(privateUserId);
      // findOtherUserIdsInCircles must have been called with only the private circle
      const [calledCircleIds] =
        membershipsService.findOtherUserIdsInCircles.mock.calls[0];
      expect(calledCircleIds).toHaveLength(1);
      expect(calledCircleIds[0].toString()).toBe(privateCircleId.toString());
    });

    it('when only public circles are selected, uses all requested circles as pool', async () => {
      const publicOid = new Types.ObjectId(publicOnlyUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([
        publicCircleId,
      ]);
      // circlesService.findByIds called once — gating check and display reuse same result
      circlesService.findByIds.mockResolvedValue([
        { id: publicCircleId.toString(), slug: 'cooking', isPrivate: false, themeId: new Types.ObjectId(), type: 'what-you-love', labels: { en: 'Cooking', es: 'Cocina' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([publicOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([publicOid]);
      usersService.findByIds.mockResolvedValue([
        { id: publicOnlyUserId, name: 'Cook User', timezone: 'Europe/Madrid' },
      ]);
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([[publicOnlyUserId, [publicCircleId]]]),
      );

      const result = await service.findTalkMatch(requesterId, [
        publicCircleId.toString(),
      ]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(publicOnlyUserId);
      // findOtherUserIdsInCircles must have been called with all requested circles
      const [calledCircleIds] =
        membershipsService.findOtherUserIdsInCircles.mock.calls[0];
      expect(calledCircleIds).toHaveLength(1);
      expect(calledCircleIds[0].toString()).toBe(publicCircleId.toString());
    });
  });

  describe('findHeardMatch', () => {
    it('filters both available-now and scheduled branches through host-exp filter', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      const scheduledOid = new Types.ObjectId(scheduledUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        liveOid,
        scheduledOid,
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      // Both branches are filtered: live keeps liveOid; scheduled drops everyone.
      usersService.filterByHasHostExp
        .mockResolvedValueOnce([liveOid])
        .mockResolvedValueOnce([]);
      usersService.findByIds.mockImplementation(async (ids: Types.ObjectId[]) =>
        ids.map((id) => ({
          id: id.toString(),
          name: 'Marta',
          timezone: 'Europe/Madrid',
          hostExp: 12,
        })),
      );
      membershipsService.findCircleMembershipsForUsers.mockResolvedValue(
        new Map([[liveUserId, [circleA]]]),
      );

      const result = await service.findHeardMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(liveUserId);
      expect(result.candidates[0].hostExp).toBe(12);
      expect(result.candidates[0].availableNow).toBe(true);

      expect(usersService.filterByHasHostExp).toHaveBeenCalledTimes(2);
      expect(usersService.filterByHasHostExp).toHaveBeenNthCalledWith(1, [
        liveOid,
      ]);
      expect(usersService.filterByHasHostExp).toHaveBeenNthCalledWith(2, [
        scheduledOid,
      ]);

      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.intent).toBe('heard');
      expect(logged.matchedUserId.toString()).toBe(liveUserId);
    });

    it('throws NotFoundException when no candidates have hostExp > 0', async () => {
      const liveOid = new Types.ObjectId(liveUserId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      circlesService.findByIds.mockResolvedValue([
        { id: circleA.toString(), slug: 'catalan', isPrivate: false, themeId: new Types.ObjectId(), type: 'who-you-are', labels: { en: 'Catalan', es: 'Catalán' }, aliases: { en: [], es: [] }, popularity: 0 },
      ]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([liveOid]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([liveOid]);
      usersService.filterByHasHostExp.mockResolvedValue([]);

      await expect(
        service.findHeardMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.intent).toBe('heard');
      expect(logged.matchedUserId).toBeNull();
    });
  });
});

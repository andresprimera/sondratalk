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

describe('MatchingService', () => {
  let service: MatchingService;
  let matchAttemptModel: Record<string, jest.Mock>;
  let membershipsService: Record<string, jest.Mock>;
  let availabilityService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let circlesService: Record<string, jest.Mock>;

  const requesterId = '507f1f77bcf86cd799439011';
  const matchedId = '507f1f77bcf86cd799439022';
  const circleA = new Types.ObjectId('507f1f77bcf86cd799439aaa');
  const circleB = new Types.ObjectId('507f1f77bcf86cd799439bbb');
  const circleC = new Types.ObjectId('507f1f77bcf86cd799439ccc');

  beforeEach(async () => {
    matchAttemptModel = { create: jest.fn().mockResolvedValue({}) };
    membershipsService = {
      findCircleIdsForUser: jest.fn(),
      findOtherUserIdsInCircles: jest.fn(),
    };
    availabilityService = {
      findAvailableNowUserIds: jest.fn(),
    };
    usersService = {
      findById: jest.fn(),
      filterByHasHostExp: jest.fn(),
    };
    circlesService = {
      findByIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: getModelToken(MatchAttempt.name), useValue: matchAttemptModel },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: UsersService, useValue: usersService },
        { provide: CirclesService, useValue: circlesService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findTalkMatch', () => {
    it('returns the matched user with first name and shared circles', async () => {
      membershipsService.findCircleIdsForUser
        .mockResolvedValueOnce([circleA, circleB, circleC]) // requester
        .mockResolvedValueOnce([circleA, circleC]); // matched user
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.findById.mockResolvedValue({
        id: matchedId,
        name: 'Ana María Pérez',
      });
      circlesService.findByIds.mockResolvedValue([
        {
          id: circleA.toString(),
          slug: 'catalan',
          themeId: new Types.ObjectId(),
          labels: { en: 'Catalan', es: 'Catalán' },
          aliases: { en: [], es: [] },
          popularity: 0,
        },
      ]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.id).toBe(matchedId);
      expect(result.firstName).toBe('Ana');
      expect(result.sharedCircles).toHaveLength(1);
      expect(result.sharedCircles[0].slug).toBe('catalan');

      // Logged with matchedUserId set
      expect(matchAttemptModel.create).toHaveBeenCalledTimes(1);
      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.userId.toString()).toBe(requesterId);
      expect(logged.intent).toBe('talk');
      expect(logged.matchedUserId.toString()).toBe(matchedId);
    });

    it('rejects circle ids that the requester is not a member of', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);

      await expect(
        service.findTalkMatch(requesterId, [
          circleA.toString(),
          circleB.toString(),
        ]),
      ).rejects.toThrow(BadRequestException);

      expect(matchAttemptModel.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException and logs null match when no candidates share circles', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([]);

      await expect(
        service.findTalkMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      expect(matchAttemptModel.create).toHaveBeenCalledTimes(1);
      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.matchedUserId).toBeNull();
    });

    it('throws NotFoundException when candidates exist but none are available', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([]);

      await expect(
        service.findTalkMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.matchedUserId).toBeNull();
    });

    it('passes excludeUserId so the requester is never returned', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([]);

      await expect(
        service.findTalkMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      expect(membershipsService.findOtherUserIdsInCircles).toHaveBeenCalledWith(
        expect.any(Array),
        requesterId,
      );
    });

    it('returns single-token name unchanged as firstName', async () => {
      membershipsService.findCircleIdsForUser
        .mockResolvedValueOnce([circleA])
        .mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.findById.mockResolvedValue({ id: matchedId, name: 'Raúl' });
      circlesService.findByIds.mockResolvedValue([]);

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.firstName).toBe('Raúl');
    });

    it('does not throw when logging the attempt fails', async () => {
      membershipsService.findCircleIdsForUser
        .mockResolvedValueOnce([circleA])
        .mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.findById.mockResolvedValue({ id: matchedId, name: 'Ana' });
      circlesService.findByIds.mockResolvedValue([]);
      matchAttemptModel.create.mockRejectedValue(new Error('db down'));

      const result = await service.findTalkMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.id).toBe(matchedId);
    });
  });

  describe('findHeardMatch', () => {
    it('returns the host with hostExp and shared circles', async () => {
      membershipsService.findCircleIdsForUser
        .mockResolvedValueOnce([circleA, circleB]) // requester
        .mockResolvedValueOnce([circleA]); // matched user
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.filterByHasHostExp.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.findById.mockResolvedValue({
        id: matchedId,
        name: 'Marta Ruiz',
        hostExp: 12,
      });
      circlesService.findByIds.mockResolvedValue([
        {
          id: circleA.toString(),
          slug: 'catalan',
          themeId: new Types.ObjectId(),
          labels: { en: 'Catalan', es: 'Catalán' },
          aliases: { en: [], es: [] },
          popularity: 0,
        },
      ]);

      const result = await service.findHeardMatch(requesterId, [
        circleA.toString(),
      ]);

      expect(result.id).toBe(matchedId);
      expect(result.firstName).toBe('Marta');
      expect(result.hostExp).toBe(12);
      expect(result.sharedCircles).toHaveLength(1);

      // Logged with intent='heard' and matchedUserId set
      expect(matchAttemptModel.create).toHaveBeenCalledTimes(1);
      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.intent).toBe('heard');
      expect(logged.matchedUserId.toString()).toBe(matchedId);
    });

    it('rejects circle ids the requester is not a member of', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);

      await expect(
        service.findHeardMatch(requesterId, [
          circleA.toString(),
          circleB.toString(),
        ]),
      ).rejects.toThrow(BadRequestException);

      expect(matchAttemptModel.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no candidates have hostExp > 0', async () => {
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        new Types.ObjectId(matchedId),
      ]);
      usersService.filterByHasHostExp.mockResolvedValue([]); // candidate exists but isn't a host

      await expect(
        service.findHeardMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      const logged = matchAttemptModel.create.mock.calls[0][0];
      expect(logged.intent).toBe('heard');
      expect(logged.matchedUserId).toBeNull();
    });

    it('passes only available candidate ids into the host filter', async () => {
      const availableId = new Types.ObjectId(matchedId);
      membershipsService.findCircleIdsForUser.mockResolvedValueOnce([circleA]);
      membershipsService.findOtherUserIdsInCircles.mockResolvedValue([
        availableId,
        new Types.ObjectId(),
      ]);
      availabilityService.findAvailableNowUserIds.mockResolvedValue([
        availableId,
      ]);
      usersService.filterByHasHostExp.mockResolvedValue([]);

      await expect(
        service.findHeardMatch(requesterId, [circleA.toString()]),
      ).rejects.toThrow(NotFoundException);

      // The host filter should receive the available subset, not the full candidate list.
      expect(usersService.filterByHasHostExp).toHaveBeenCalledWith([
        availableId,
      ]);
    });
  });
});

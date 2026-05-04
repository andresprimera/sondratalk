import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { Membership } from './schemas/membership.schema';
import { CircleDocument } from '../circles/schemas/circle.schema';
import { CirclesService } from '../circles/circles.service';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let membershipModel: Record<string, jest.Mock>;
  let circlesService: { findByIds: jest.Mock };

  const userId = '507f1f77bcf86cd799439011';
  const circleId1 = '507f1f77bcf86cd799439021';
  const circleId2 = '507f1f77bcf86cd799439022';
  const circleId3 = '507f1f77bcf86cd799439023';

  const buildMockCircle = (id: string, slug: string): CircleDocument =>
    ({
      id,
      slug,
      themeId: { toString: () => 'theme-1' },
      labels: { en: slug, es: slug },
      aliases: { en: [], es: [] },
      popularity: 0,
      themeLabels: { en: 'Dogs', es: 'Perros' },
    }) as unknown as CircleDocument;

  beforeEach(async () => {
    membershipModel = {
      find: jest.fn(),
      bulkWrite: jest.fn(),
    };
    circlesService = {
      findByIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        {
          provide: getModelToken(Membership.name),
          useValue: membershipModel,
        },
        { provide: CirclesService, useValue: circlesService },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
  });

  describe('replaceCirclesForUser', () => {
    it('happy path: all new IDs, no existing memberships → bulkWrite with N inserts, 0 deletes', async () => {
      const c1 = buildMockCircle(circleId1, 'german-shepherd');
      const c2 = buildMockCircle(circleId2, 'golden-retriever');
      circlesService.findByIds.mockResolvedValue([c1, c2]);

      const findChain = { select: jest.fn().mockResolvedValue([]) };
      membershipModel.find.mockReturnValue(findChain);

      const result = await service.replaceCirclesForUser(userId, [
        circleId1,
        circleId2,
      ]);

      expect(membershipModel.bulkWrite).toHaveBeenCalledTimes(1);
      const [ops, options] = membershipModel.bulkWrite.mock.calls[0];
      expect(options).toEqual({ ordered: false });
      expect(ops).toHaveLength(2);
      expect(ops.every((op: { insertOne?: unknown }) => op.insertOne)).toBe(
        true,
      );
      expect(result).toEqual([c1, c2]);
    });

    it('idempotent no-op: same set as before → no bulkWrite call', async () => {
      const c1 = buildMockCircle(circleId1, 'german-shepherd');
      const c2 = buildMockCircle(circleId2, 'golden-retriever');
      circlesService.findByIds.mockResolvedValue([c1, c2]);

      const findChain = {
        select: jest.fn().mockResolvedValue([
          { circleId: { toString: () => circleId1 } },
          { circleId: { toString: () => circleId2 } },
        ]),
      };
      membershipModel.find.mockReturnValue(findChain);

      await service.replaceCirclesForUser(userId, [circleId1, circleId2]);

      expect(membershipModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('partial diff: 1 retained, 1 inserted, 1 deleted', async () => {
      const c1 = buildMockCircle(circleId1, 'german-shepherd');
      const c3 = buildMockCircle(circleId3, 'tennis');
      circlesService.findByIds.mockResolvedValue([c1, c3]);

      const findChain = {
        select: jest.fn().mockResolvedValue([
          { circleId: { toString: () => circleId1 } },
          { circleId: { toString: () => circleId2 } },
        ]),
      };
      membershipModel.find.mockReturnValue(findChain);

      await service.replaceCirclesForUser(userId, [circleId1, circleId3]);

      expect(membershipModel.bulkWrite).toHaveBeenCalledTimes(1);
      const ops = membershipModel.bulkWrite.mock.calls[0][0];
      const deletes = ops.filter(
        (op: { deleteMany?: unknown }) => op.deleteMany,
      );
      const inserts = ops.filter(
        (op: { insertOne?: unknown }) => op.insertOne,
      );
      expect(deletes).toHaveLength(1);
      expect(inserts).toHaveLength(1);
    });

    it('throws BadRequestException when one circle id is missing', async () => {
      const c1 = buildMockCircle(circleId1, 'german-shepherd');
      // Only one circle returned even though two were requested
      circlesService.findByIds.mockResolvedValue([c1]);

      await expect(
        service.replaceCirclesForUser(userId, [circleId1, circleId2]),
      ).rejects.toThrow(BadRequestException);
      expect(membershipModel.bulkWrite).not.toHaveBeenCalled();
    });

    it('handles empty circleIds (deletes all existing memberships)', async () => {
      circlesService.findByIds.mockResolvedValue([]);

      const findChain = {
        select: jest.fn().mockResolvedValue([
          { circleId: { toString: () => circleId1 } },
        ]),
      };
      membershipModel.find.mockReturnValue(findChain);

      await service.replaceCirclesForUser(userId, []);

      expect(membershipModel.bulkWrite).toHaveBeenCalledTimes(1);
      const ops = membershipModel.bulkWrite.mock.calls[0][0];
      expect(ops).toHaveLength(1);
      expect(ops[0].deleteMany).toBeDefined();
    });
  });

  describe('findCirclesForUser', () => {
    it('returns hydrated Circle[] from populated memberships', async () => {
      const c1 = buildMockCircle(circleId1, 'german-shepherd');
      const c2 = buildMockCircle(circleId2, 'golden-retriever');
      const findChain = {
        populate: jest
          .fn()
          .mockResolvedValue([{ circleId: c1 }, { circleId: c2 }]),
      };
      membershipModel.find.mockReturnValue(findChain);

      const result = await service.findCirclesForUser(userId);

      expect(findChain.populate).toHaveBeenCalledWith('circleId');
      expect(result).toEqual([c1, c2]);
    });

    it('returns empty array when no memberships exist', async () => {
      const findChain = {
        populate: jest.fn().mockResolvedValue([]),
      };
      membershipModel.find.mockReturnValue(findChain);

      const result = await service.findCirclesForUser(userId);

      expect(result).toEqual([]);
    });
  });
});

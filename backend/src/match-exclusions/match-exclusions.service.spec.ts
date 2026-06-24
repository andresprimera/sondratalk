import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MatchExclusionsService } from './match-exclusions.service';
import { MatchExclusion } from './schemas/match-exclusion.schema';

const FROM_USER_ID = '507f1f77bcf86cd799439011';
const TO_USER_ID = '507f1f77bcf86cd799439022';

describe('MatchExclusionsService', () => {
  let service: MatchExclusionsService;
  const matchExclusionModel = {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchExclusionsService,
        {
          provide: getModelToken(MatchExclusion.name),
          useValue: matchExclusionModel,
        },
      ],
    }).compile();
    service = module.get<MatchExclusionsService>(MatchExclusionsService);
  });

  describe('create', () => {
    it('upserts the (fromUserId, toUserId) exclusion', async () => {
      matchExclusionModel.findOneAndUpdate.mockResolvedValue({});

      await service.create(FROM_USER_ID, TO_USER_ID);

      const [filter, update, options] =
        matchExclusionModel.findOneAndUpdate.mock.calls[0];
      expect(filter.fromUserId.toString()).toBe(FROM_USER_ID);
      expect(filter.toUserId.toString()).toBe(TO_USER_ID);
      expect(update).toEqual({});
      expect(options).toMatchObject({ upsert: true });
    });
  });

  describe('findExcludedUserIds', () => {
    it('returns the toUserIds the given user has excluded', async () => {
      const excludedOid = new Types.ObjectId(TO_USER_ID);
      matchExclusionModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ toUserId: excludedOid }]),
      });

      const result = await service.findExcludedUserIds(FROM_USER_ID);

      expect(result).toEqual([excludedOid]);
      const filter = matchExclusionModel.find.mock.calls[0][0];
      expect(filter.fromUserId.toString()).toBe(FROM_USER_ID);
    });

    it('returns an empty array when the user has no exclusions', async () => {
      matchExclusionModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findExcludedUserIds(FROM_USER_ID);

      expect(result).toEqual([]);
    });
  });
});

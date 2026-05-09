import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { periodEnum, dayEnum } from '@base-dashboard/shared';
import { AvailabilityService } from './availability.service';
import {
  Availability,
  AvailabilityDocument,
  PERIODS,
  DAYS,
} from './schemas/availability.schema';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let model: Record<string, jest.Mock>;

  const userId = '507f1f77bcf86cd799439011';

  const mockDoc = {
    userId: new Types.ObjectId(userId),
    windows: [{ period: 'morning', day: 'mon' }],
    isAvailableNow: false,
  } as unknown as AvailabilityDocument;

  beforeEach(async () => {
    model = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: getModelToken(Availability.name), useValue: model },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  describe('findByUserId', () => {
    it('queries by userId converted to ObjectId', async () => {
      model.findOne.mockResolvedValue(mockDoc);

      const result = await service.findByUserId(userId);

      expect(model.findOne).toHaveBeenCalledTimes(1);
      const filter = model.findOne.mock.calls[0][0];
      expect(filter.userId).toBeInstanceOf(Types.ObjectId);
      expect(filter.userId.toString()).toBe(userId);
      expect(result).toEqual(mockDoc);
    });

    it('returns null when no doc exists', async () => {
      model.findOne.mockResolvedValue(null);
      expect(await service.findByUserId(userId)).toBeNull();
    });
  });

  describe('upsertByUserId', () => {
    it('upserts windows with $setOnInsert and setDefaultsOnInsert', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockDoc);

      const windows = [
        { period: 'morning' as const, day: 'mon' as const },
        { period: 'evening' as const, day: 'sat' as const },
      ];
      const result = await service.upsertByUserId(userId, { windows });

      expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update, options] = model.findOneAndUpdate.mock.calls[0];

      expect(filter.userId).toBeInstanceOf(Types.ObjectId);
      expect(filter.userId.toString()).toBe(userId);

      expect(update.$set).toEqual({ windows });
      expect(update.$set.isAvailableNow).toBeUndefined();
      expect(update.$setOnInsert.userId).toBeInstanceOf(Types.ObjectId);
      expect(update.$setOnInsert.userId.toString()).toBe(userId);

      expect(options).toEqual({
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      });
      expect(result).toEqual(mockDoc);
    });

    it('upserts only isAvailableNow when windows omitted', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockDoc);

      await service.upsertByUserId(userId, { isAvailableNow: true });

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toEqual({ isAvailableNow: true });
      expect(update.$set.windows).toBeUndefined();
    });

    it('dedupes duplicate {period,day} pairs in windows', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockDoc);

      const windows = [
        { period: 'morning' as const, day: 'mon' as const },
        { period: 'morning' as const, day: 'mon' as const },
        { period: 'evening' as const, day: 'sat' as const },
      ];
      await service.upsertByUserId(userId, { windows });

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set.windows).toEqual([
        { period: 'morning', day: 'mon' },
        { period: 'evening', day: 'sat' },
      ]);
    });

    it('throws when the upsert returns no document', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.upsertByUserId(userId, { isAvailableNow: false }),
      ).rejects.toThrow(/no document/i);
    });
  });

  describe('removeByUserId', () => {
    it('deletes the doc by userId', async () => {
      model.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.removeByUserId(userId);

      expect(model.deleteOne).toHaveBeenCalledTimes(1);
      const filter = model.deleteOne.mock.calls[0][0];
      expect(filter.userId).toBeInstanceOf(Types.ObjectId);
      expect(filter.userId.toString()).toBe(userId);
    });
  });

  describe('enum sanity', () => {
    it('Mongoose PERIODS matches Zod periodEnum.options', () => {
      expect([...PERIODS]).toEqual(periodEnum.options);
    });

    it('Mongoose DAYS matches Zod dayEnum.options', () => {
      expect([...DAYS]).toEqual(dayEnum.options);
    });
  });
});

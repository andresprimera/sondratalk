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
      updateOne: jest.fn(),
      find: jest.fn(),
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
      expect(update.$set.isAvailableNow).toBe(true);
      expect(update.$set.availableNowSetAt).toBeInstanceOf(Date);
      expect(update.$set.windows).toBeUndefined();
    });

    it('unsets availableNowSetAt when going offline', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockDoc);

      await service.upsertByUserId(userId, { isAvailableNow: false });

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$set.isAvailableNow).toBe(false);
      expect(update.$set.availableNowSetAt).toBeUndefined();
      expect(update.$unset).toEqual({ availableNowSetAt: '' });
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

  describe('touchAvailableNow', () => {
    it('only bumps timestamp for rows that are currently online', async () => {
      const updatedDoc = { ...mockDoc, isAvailableNow: true };
      model.findOneAndUpdate.mockResolvedValue(updatedDoc);

      const result = await service.touchAvailableNow(userId);

      expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update, options] = model.findOneAndUpdate.mock.calls[0];
      expect(filter.userId).toBeInstanceOf(Types.ObjectId);
      expect(filter.userId.toString()).toBe(userId);
      expect(filter.isAvailableNow).toBe(true);
      expect(update.$set.availableNowSetAt).toBeInstanceOf(Date);
      expect(options).toEqual({ new: true });
      expect(result).toBe(updatedDoc);
    });

    it('returns null when no online row exists (no-op heartbeat)', async () => {
      model.findOneAndUpdate.mockResolvedValue(null);
      expect(await service.touchAvailableNow(userId)).toBeNull();
    });
  });

  describe('clearAvailableNow', () => {
    it('flips isAvailableNow off and unsets the timestamp', async () => {
      model.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.clearAvailableNow(userId);

      expect(model.updateOne).toHaveBeenCalledTimes(1);
      const [filter, update] = model.updateOne.mock.calls[0];
      expect(filter.userId).toBeInstanceOf(Types.ObjectId);
      expect(filter.userId.toString()).toBe(userId);
      expect(update.$set).toEqual({ isAvailableNow: false });
      expect(update.$unset).toEqual({ availableNowSetAt: '' });
    });
  });

  describe('findAvailableNowUserIds', () => {
    it('returns [] when no candidates are passed', async () => {
      const result = await service.findAvailableNowUserIds(
        [],
        new Date(0),
      );
      expect(result).toEqual([]);
      expect(model.find).not.toHaveBeenCalled();
    });

    it('filters by freshness window', async () => {
      const candidate = new Types.ObjectId();
      const freshSince = new Date('2026-01-01T00:00:00Z');
      model.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ userId: candidate }]),
      });

      const result = await service.findAvailableNowUserIds(
        [candidate],
        freshSince,
      );

      expect(model.find).toHaveBeenCalledTimes(1);
      const filter = model.find.mock.calls[0][0];
      expect(filter.isAvailableNow).toBe(true);
      expect(filter.availableNowSetAt).toEqual({ $gte: freshSince });
      expect(result).toEqual([candidate]);
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

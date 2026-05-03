import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CirclesService } from './circles.service';
import { Circle, CircleDocument } from './schemas/circle.schema';

describe('CirclesService', () => {
  let service: CirclesService;
  let model: Record<string, jest.Mock>;

  const mockCircle = {
    id: 'circle-1',
    slug: 'german-shepherd',
    themeId: { toString: () => 'theme-1' },
    labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
    aliases: { en: ['GSD'], es: [] },
    popularity: 0,
  } as unknown as CircleDocument;

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      exists: jest.fn(),
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CirclesService,
        { provide: getModelToken(Circle.name), useValue: model },
      ],
    }).compile();

    service = module.get<CirclesService>(CirclesService);
  });

  describe('create', () => {
    it('persists the circle with default aliases when none are passed', async () => {
      model.create.mockResolvedValue(mockCircle);

      const result = await service.create({
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        popularity: 0,
      });

      expect(model.create).toHaveBeenCalledWith({
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        aliases: { en: [], es: [] },
        popularity: 0,
      });
      expect(result).toEqual(mockCircle);
    });

    it('persists aliases passed by the caller', async () => {
      model.create.mockResolvedValue(mockCircle);

      await service.create({
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        aliases: { en: ['GSD'], es: [] },
        popularity: 0,
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aliases: { en: ['GSD'], es: [] },
        }),
      );
    });
  });

  describe('findAllPaginated', () => {
    it('returns paginated results filtered by themeId when provided', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCircle]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAllPaginated(1, 10, 'theme-1');

      expect(model.find).toHaveBeenCalledWith({ themeId: 'theme-1' });
      expect(chainable.sort).toHaveBeenCalledWith({ popularity: -1, slug: 1 });
      expect(chainable.skip).toHaveBeenCalledWith(0);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [mockCircle], total: 1 });
    });

    it('returns all when themeId is omitted', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(0);

      await service.findAllPaginated(2, 10);

      expect(model.find).toHaveBeenCalledWith({});
      expect(chainable.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('searchPaginated', () => {
    it('runs Atlas $search aggregation scoped to the locale and ranks by score', async () => {
      model.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([mockCircle]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { total: 1 } }]),
        });

      const result = await service.searchPaginated(
        'ger',
        1,
        10,
        'en',
        '507f1f77bcf86cd799439011',
      );

      expect(model.aggregate).toHaveBeenCalledTimes(2);

      const searchPipeline = model.aggregate.mock.calls[0][0];
      expect(searchPipeline).toEqual([
        {
          $search: {
            compound: expect.objectContaining({
              should: expect.arrayContaining([
                { autocomplete: { query: 'ger', path: 'labels.en' } },
                { autocomplete: { query: 'ger', path: 'aliases.en' } },
                {
                  text: {
                    query: 'ger',
                    path: 'labels.en',
                    fuzzy: { maxEdits: 1 },
                  },
                },
              ]),
              filter: [
                {
                  equals: {
                    path: 'themeId',
                    value: expect.anything(),
                  },
                },
              ],
              minimumShouldMatch: 1,
            }),
          },
        },
        { $sort: { score: { $meta: 'searchScore' }, popularity: -1 } },
        { $skip: 0 },
        { $limit: 10 },
      ]);

      const metaPipeline = model.aggregate.mock.calls[1][0];
      expect(metaPipeline).toEqual([
        {
          $searchMeta: expect.objectContaining({
            compound: expect.objectContaining({ minimumShouldMatch: 1 }),
            count: { type: 'total' },
          }),
        },
      ]);

      expect(result).toEqual({ data: [mockCircle], total: 1 });
    });

    it('omits the themeId filter when not provided', async () => {
      model.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { total: 0 } }]),
        });

      await service.searchPaginated('ger', 1, 10, 'en');

      const searchStage = model.aggregate.mock.calls[0][0][0].$search;
      expect(searchStage.compound.filter).toBeUndefined();
    });

    it('uses the spanish locale paths when locale is "es"', async () => {
      model.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { total: 0 } }]),
        });

      await service.searchPaginated('pastor', 1, 10, 'es');

      const searchStage = model.aggregate.mock.calls[0][0][0].$search;
      expect(searchStage.compound.should).toContainEqual({
        autocomplete: { query: 'pastor', path: 'labels.es' },
      });
      expect(searchStage.compound.should).toContainEqual({
        autocomplete: { query: 'pastor', path: 'aliases.es' },
      });
      expect(searchStage.compound.should).toContainEqual({
        text: {
          query: 'pastor',
          path: 'labels.es',
          fuzzy: { maxEdits: 1 },
        },
      });
    });

    it('falls back to the lowerBound count when total is missing', async () => {
      model.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([mockCircle]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { lowerBound: 42 } }]),
        });

      const result = await service.searchPaginated('x', 1, 10, 'en');

      expect(result.total).toBe(42);
    });

    it('returns total: 0 when meta is empty', async () => {
      model.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

      const result = await service.searchPaginated('nothing', 1, 10, 'en');

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('throws when called with an unsupported locale', async () => {
      await expect(
        // eslint-disable-next-line no-restricted-syntax -- simulate an out-of-band caller bypassing the LocaleKey type
        service.searchPaginated('x', 1, 10, 'fr' as never),
      ).rejects.toThrow(/unsupported locale/i);
    });
  });

  describe('findById', () => {
    it('returns the circle when found', async () => {
      model.findById.mockResolvedValue(mockCircle);

      const result = await service.findById('circle-1');

      expect(model.findById).toHaveBeenCalledWith('circle-1');
      expect(result).toEqual(mockCircle);
    });

    it('returns null when not found', async () => {
      model.findById.mockResolvedValue(null);

      expect(await service.findById('missing')).toBeNull();
    });
  });

  describe('findBySlugExists', () => {
    it('returns true when exists() resolves to a doc', async () => {
      model.exists.mockReturnValue(Promise.resolve({ _id: 'circle-1' }));
      expect(await service.findBySlugExists('german-shepherd')).toBe(true);
    });

    it('returns false when exists() resolves to null', async () => {
      model.exists.mockReturnValue(Promise.resolve(null));
      expect(await service.findBySlugExists('missing')).toBe(false);
    });
  });

  describe('update', () => {
    it('passes the dto through to findByIdAndUpdate', async () => {
      const updated = { ...mockCircle, popularity: 5 };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.update('circle-1', { popularity: 5 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { popularity: 5 },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('returns null when the doc is missing', async () => {
      model.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.update('missing', {
        labels: { en: 'A', es: 'B' },
      });

      expect(result).toBeNull();
    });
  });

  describe('upsertById', () => {
    it('upserts by id with setDefaultsOnInsert and default aliases', async () => {
      const seed = {
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        popularity: 0,
      };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'circle-1', ...seed });

      const result = await service.upsertById('circle-1', seed);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { ...seed, aliases: { en: [], es: [] } },
        { upsert: true, setDefaultsOnInsert: true, new: true },
      );
      expect(result).toEqual({ id: 'circle-1', ...seed });
    });

    it('preserves caller-supplied aliases', async () => {
      const seed = {
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        aliases: { en: ['GSD'], es: [] },
        popularity: 0,
      };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'circle-1', ...seed });

      await service.upsertById('circle-1', seed);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        seed,
        { upsert: true, setDefaultsOnInsert: true, new: true },
      );
    });
  });

  describe('remove', () => {
    it('deletes by id', async () => {
      model.findByIdAndDelete.mockResolvedValue(mockCircle);
      await service.remove('circle-1');
      expect(model.findByIdAndDelete).toHaveBeenCalledWith('circle-1');
    });
  });
});

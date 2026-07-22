import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CirclesService } from './circles.service';
import { Circle, CircleDocument } from './schemas/circle.schema';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

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
      findOneAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      deleteMany: jest.fn(),
      exists: jest.fn(),
      aggregate: jest.fn(),
      hydrate: jest.fn((doc: unknown) => doc),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CirclesService,
        { provide: getModelToken(Circle.name), useValue: model },
      ],
    }).compile();

    service = module.get<CirclesService>(CirclesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const themeLabels = { en: 'Dogs', es: 'Perros' };

    it('persists the circle with default aliases and the snapshot themeLabels', async () => {
      model.create.mockResolvedValue(mockCircle);

      const result = await service.create(
        {
          slug: 'german-shepherd',
          themeId: 'theme-1',
          type: 'what-you-love',
          labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
          popularity: 0,
        },
        themeLabels,
      );

      expect(model.create).toHaveBeenCalledWith({
        slug: 'german-shepherd',
        themeId: 'theme-1',
        type: 'what-you-love',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        aliases: { en: [], es: [] },
        themeLabels,
        popularity: 0,
      });
      expect(result).toEqual(mockCircle);
    });

    it('persists aliases passed by the caller', async () => {
      model.create.mockResolvedValue(mockCircle);

      await service.create(
        {
          slug: 'german-shepherd',
          themeId: 'theme-1',
          type: 'what-you-love',
          labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
          aliases: { en: ['GSD'], es: [] },
          popularity: 0,
        },
        themeLabels,
      );

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aliases: { en: ['GSD'], es: [] },
        }),
      );
    });

    it('hashes the password for a private circle and never persists it in plaintext', async () => {
      model.create.mockResolvedValue(mockCircle);
      mockedBcrypt.hash.mockResolvedValue('hashed-secret' as never);

      await service.create(
        {
          slug: 'private-circle',
          themeId: 'theme-1',
          type: 'what-you-love',
          labels: { en: 'Private', es: 'Privado' },
          isPrivate: true,
          password: 'plaintext-secret',
        },
        themeLabels,
      );

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-secret', 12);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-secret', isPrivate: true }),
      );
    });

    it('does not set a password for a non-private circle', async () => {
      model.create.mockResolvedValue(mockCircle);

      await service.create(
        {
          slug: 'public-circle',
          themeId: 'theme-1',
          type: 'what-you-love',
          labels: { en: 'Public', es: 'Público' },
        },
        themeLabels,
      );

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      const callArgs = model.create.mock.calls[0][0];
      expect(callArgs.password).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns every circle sorted by popularity then slug', async () => {
      const chainable = {
        sort: jest.fn().mockResolvedValue([mockCircle]),
      };
      model.find.mockReturnValue(chainable);

      const result = await service.findAll();

      expect(model.find).toHaveBeenCalledWith();
      expect(chainable.sort).toHaveBeenCalledWith({ popularity: -1, slug: 1 });
      expect(result).toEqual([mockCircle]);
    });
  });

  describe('findAllPaginated', () => {
    it('returns paginated results filtered by themeId when provided, excluding private circles', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCircle]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAllPaginated(1, 10, 'theme-1');

      expect(model.find).toHaveBeenCalledWith({
        isPrivate: { $ne: true },
        themeId: 'theme-1',
      });
      expect(chainable.sort).toHaveBeenCalledWith({ popularity: -1, slug: 1 });
      expect(chainable.skip).toHaveBeenCalledWith(0);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [mockCircle], total: 1 });
    });

    it('excludes private circles when themeId is omitted', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(0);

      await service.findAllPaginated(2, 10);

      expect(model.find).toHaveBeenCalledWith({ isPrivate: { $ne: true } });
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
            index: 'circles_search',
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
            index: 'circles_search',
            compound: expect.objectContaining({ minimumShouldMatch: 1 }),
            count: { type: 'total' },
          }),
        },
      ]);

      expect(result).toEqual({ data: [mockCircle], total: 1 });
      expect(model.hydrate).toHaveBeenCalledWith(mockCircle);
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

  describe('findAllPaginatedForAdmin', () => {
    const aggRow = {
      _id: { toString: () => 'circle-1' },
      slug: 'german-shepherd',
      themeId: { toString: () => 'theme-1' },
      type: 'what-you-love',
      labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
      aliases: { en: ['GSD'], es: [] },
      popularity: 0,
      membershipCount: 4,
    };

    it('maps aggregate rows with membershipCount', async () => {
      model.aggregate.mockResolvedValue([
        { data: [aggRow], total: [{ n: 1 }] },
      ]);

      const result = await service.findAllPaginatedForAdmin(1, 10);

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ membershipCount: 4 });
    });

    it('sorts by the requested field and direction', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(1, 10, undefined, 'popularity', 'desc');

      const pipeline = model.aggregate.mock.calls[0][0];
      const sortStage = pipeline.find((s: Record<string, unknown>) => '$sort' in s);
      expect(sortStage.$sort).toEqual({ membershipCount: -1 });
    });

    it('filters by themeId when provided', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(1, 10, '507f1f77bcf86cd799439011');

      const pipeline = model.aggregate.mock.calls[0][0];
      const matchStage = pipeline.find((s: Record<string, unknown>) => '$match' in s);
      expect(matchStage).toBeDefined();
    });

    it('returns empty data and zero total when aggregate yields no result', async () => {
      model.aggregate.mockResolvedValue([]);

      const result = await service.findAllPaginatedForAdmin(1, 10);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  describe('searchPaginatedForAdmin', () => {
    const aggRow = {
      _id: { toString: () => 'circle-1' },
      slug: 'german-shepherd',
      themeId: { toString: () => 'theme-1' },
      type: 'what-you-love',
      labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
      aliases: { en: ['GSD'], es: [] },
      popularity: 0,
      membershipCount: 2,
    };

    it('runs Atlas $search with a membership count lookup', async () => {
      model.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([aggRow]) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { total: 1 } }]),
        });

      const result = await service.searchPaginatedForAdmin('ger', 1, 10, 'en');

      const searchPipeline = model.aggregate.mock.calls[0][0];
      const lookupStage = searchPipeline.find(
        (s: Record<string, unknown>) => '$lookup' in s,
      );
      expect(lookupStage.$lookup.from).toBe('circle_memberships');
      expect(result).toEqual({ data: [aggRow], total: 1 });
    });

    it('honors the requested column sort over the default relevance order', async () => {
      model.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ count: { total: 0 } }]),
        });

      await service.searchPaginatedForAdmin(
        'ger',
        1,
        10,
        'en',
        undefined,
        'popularity',
        'desc',
      );

      const searchPipeline = model.aggregate.mock.calls[0][0];
      const sortStage = searchPipeline.find(
        (s: Record<string, unknown>) => '$sort' in s,
      );
      expect(sortStage.$sort.membershipCount).toBe(-1);
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

  describe('findByIdWithPassword', () => {
    it('selects the password field explicitly', async () => {
      const chainable = { select: jest.fn().mockResolvedValue(mockCircle) };
      model.findById.mockReturnValue(chainable);

      const result = await service.findByIdWithPassword('circle-1');

      expect(model.findById).toHaveBeenCalledWith('circle-1');
      expect(chainable.select).toHaveBeenCalledWith('+password');
      expect(result).toEqual(mockCircle);
    });
  });

  describe('verifyPassword', () => {
    it('returns true when the password matches the stored hash', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      const circle = { ...mockCircle, password: 'hashed-secret' } as unknown as CircleDocument;

      const result = await service.verifyPassword(circle, 'plaintext-secret');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'plaintext-secret',
        'hashed-secret',
      );
      expect(result).toBe(true);
    });

    it('returns false when the password does not match', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      const circle = { ...mockCircle, password: 'hashed-secret' } as unknown as CircleDocument;

      expect(await service.verifyPassword(circle, 'wrong')).toBe(false);
    });

    it('returns false without comparing when the circle has no password set', async () => {
      const circle = { ...mockCircle, password: undefined } as unknown as CircleDocument;

      const result = await service.verifyPassword(circle, 'anything');

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
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
    function mockCurrent(overrides: Record<string, unknown> = {}) {
      model.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockCircle, ...overrides }),
      });
    }

    it('passes the dto through to findByIdAndUpdate', async () => {
      mockCurrent();
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
      model.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await service.update('missing', {
        labels: { en: 'A', es: 'B' },
      });

      expect(result).toBeNull();
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('hashes a newly supplied password instead of storing it in plaintext', async () => {
      mockCurrent();
      model.findByIdAndUpdate.mockResolvedValue(mockCircle);
      mockedBcrypt.hash.mockResolvedValue('hashed-secret' as never);

      await service.update('circle-1', {
        isPrivate: true,
        password: 'plaintext-secret',
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-secret', 12);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { isPrivate: true, password: 'hashed-secret' },
        { new: true },
      );
    });

    it('throws BadRequestException when marking private with no password and none stored', async () => {
      mockCurrent({ isPrivate: false, password: undefined });

      await expect(
        service.update('circle-1', { isPrivate: true }),
      ).rejects.toThrow(BadRequestException);
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows re-confirming isPrivate: true without a new password when one already exists', async () => {
      mockCurrent({ isPrivate: true, password: 'existing-hash' });
      model.findByIdAndUpdate.mockResolvedValue(mockCircle);

      await service.update('circle-1', { isPrivate: true, slug: 'renamed' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { isPrivate: true, slug: 'renamed' },
        { new: true },
      );
    });

    it('clears the stored password hash when explicitly un-privating', async () => {
      mockCurrent({ isPrivate: true, password: 'existing-hash' });
      model.findByIdAndUpdate.mockResolvedValue(mockCircle);

      await service.update('circle-1', { isPrivate: false });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { $set: { isPrivate: false }, $unset: { password: '' } },
        { new: true },
      );
    });

    it('drops a simultaneously-supplied password when un-privating, instead of conflicting $set/$unset', async () => {
      mockCurrent({ isPrivate: true, password: 'existing-hash' });
      model.findByIdAndUpdate.mockResolvedValue(mockCircle);
      mockedBcrypt.hash.mockResolvedValue('hashed-secret' as never);

      await service.update('circle-1', {
        isPrivate: false,
        password: 'new-plaintext',
      });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { $set: { isPrivate: false }, $unset: { password: '' } },
        { new: true },
      );
    });
  });

  describe('upsertById', () => {
    const themeLabels = { en: 'Dogs', es: 'Perros' };

    it('upserts by id with setDefaultsOnInsert, default aliases, and themeLabels', async () => {
      const seed = {
        slug: 'german-shepherd',
        themeId: 'theme-1',
        type: 'what-you-love' as const,
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        popularity: 0,
      };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'circle-1', ...seed });

      const result = await service.upsertById('circle-1', seed, themeLabels);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { ...seed, aliases: { en: [], es: [] }, themeLabels },
        { upsert: true, setDefaultsOnInsert: true, new: true },
      );
      expect(result).toEqual({ id: 'circle-1', ...seed });
    });

    it('preserves caller-supplied aliases', async () => {
      const seed = {
        slug: 'german-shepherd',
        themeId: 'theme-1',
        type: 'what-you-love' as const,
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        aliases: { en: ['GSD'], es: [] },
        popularity: 0,
      };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'circle-1', ...seed });

      await service.upsertById('circle-1', seed, themeLabels);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { ...seed, themeLabels },
        { upsert: true, setDefaultsOnInsert: true, new: true },
      );
    });

    it('hashes the password when seeding a private circle', async () => {
      const seed = {
        slug: 'private-circle',
        themeId: 'theme-1',
        type: 'what-you-love' as const,
        labels: { en: 'Private', es: 'Privado' },
        isPrivate: true,
        password: 'plaintext-secret',
      };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'circle-1', ...seed });
      mockedBcrypt.hash.mockResolvedValue('hashed-secret' as never);

      await service.upsertById('circle-1', seed, themeLabels);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-secret', 12);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        expect.objectContaining({ password: 'hashed-secret' }),
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

  describe('removeAll', () => {
    it('deletes every circle via deleteMany', async () => {
      model.deleteMany.mockResolvedValue({ deletedCount: 3 });
      await service.removeAll();
      expect(model.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe('findOrCreateCustom', () => {
    it('upserts a public circle with a namespaced slug and the label on both locales', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockCircle);

      const result = await service.findOrCreateCustom('  Salsa Dancing  ');

      expect(result).toBe(mockCircle);
      const [filter, update, options] =
        model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ slug: 'custom-salsa-dancing' });
      expect(options).toEqual({
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
      expect(update.$setOnInsert).toMatchObject({
        slug: 'custom-salsa-dancing',
        type: 'what-you-love',
        labels: { en: 'Salsa Dancing', es: 'Salsa Dancing' },
        isPrivate: false,
        popularity: 0,
      });
    });

    it('slugs case- and accent-insensitively so equivalent labels dedupe', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockCircle);

      await service.findOrCreateCustom('Café Culture');
      await service.findOrCreateCustom('cafe culture');

      const slugA = model.findOneAndUpdate.mock.calls[0][0].slug;
      const slugB = model.findOneAndUpdate.mock.calls[1][0].slug;
      expect(slugA).toBe('custom-cafe-culture');
      expect(slugB).toBe('custom-cafe-culture');
    });

    it('falls back to a stable hashed slug when the label has no latin characters', async () => {
      model.findOneAndUpdate.mockResolvedValue(mockCircle);

      await service.findOrCreateCustom('日本語');
      await service.findOrCreateCustom('日本語');

      const slugA = model.findOneAndUpdate.mock.calls[0][0].slug;
      const slugB = model.findOneAndUpdate.mock.calls[1][0].slug;
      expect(slugA).toMatch(/^custom-[a-f0-9]{12}$/);
      expect(slugA).toBe(slugB);
    });
  });
});

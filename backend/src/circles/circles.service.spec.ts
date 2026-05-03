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
    it('persists the circle with built searchTerms and default aliases', async () => {
      model.create.mockResolvedValue(mockCircle);

      const result = await service.create({
        slug: 'german-shepherd',
        themeId: 'theme-1',
        labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
        popularity: 0,
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'german-shepherd',
          themeId: 'theme-1',
          labels: { en: 'German Shepherd', es: 'Pastor Alemán' },
          aliases: { en: [], es: [] },
          searchTerms: expect.arrayContaining([
            'german shepherd',
            'pastor aleman',
          ]),
        }),
      );
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
          searchTerms: expect.arrayContaining(['gsd']),
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
    it('runs $text query with normalized term and ranks by score', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCircle]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.searchPaginated(
        'Pastor Alemán',
        1,
        10,
        'theme-1',
      );

      expect(model.find).toHaveBeenCalledWith(
        {
          $text: { $search: 'pastor aleman' },
          themeId: 'theme-1',
        },
        { score: { $meta: 'textScore' } },
      );
      expect(chainable.sort).toHaveBeenCalledWith({
        score: { $meta: 'textScore' },
        popularity: -1,
      });
      expect(result).toEqual({ data: [mockCircle], total: 1 });
    });

    it('omits themeId from filter when not provided', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(0);

      await service.searchPaginated('gsd', 1, 10);

      expect(model.find).toHaveBeenCalledWith(
        { $text: { $search: 'gsd' } },
        { score: { $meta: 'textScore' } },
      );
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
    it('updates without rebuilding searchTerms when neither labels nor aliases change', async () => {
      const updated = { ...mockCircle, popularity: 5 };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.update(mockCircle, { popularity: 5 });

      expect(model.findById).not.toHaveBeenCalled();
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        { popularity: 5 },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('rebuilds searchTerms when labels change', async () => {
      model.findByIdAndUpdate.mockResolvedValue(mockCircle);

      await service.update(mockCircle, {
        labels: { en: 'German Shepherd Dog', es: 'Pastor Alemán' },
      });

      expect(model.findById).not.toHaveBeenCalled();
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'circle-1',
        expect.objectContaining({
          searchTerms: expect.arrayContaining([
            'german shepherd dog',
            'pastor aleman',
            'gsd',
          ]),
        }),
        { new: true },
      );
    });

    it('returns null when the doc was deleted between fetch and update', async () => {
      model.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.update(mockCircle, {
        labels: { en: 'A', es: 'B' },
      });

      expect(result).toBeNull();
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

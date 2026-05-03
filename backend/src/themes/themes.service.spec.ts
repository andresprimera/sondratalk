import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ThemesService } from './themes.service';
import { Theme } from './schemas/theme.schema';

describe('ThemesService', () => {
  let service: ThemesService;
  let model: Record<string, jest.Mock>;

  const mockTheme = {
    id: 'theme-1',
    slug: 'dogs',
    label: 'Dogs',
    sortOrder: 0,
  };

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
        ThemesService,
        { provide: getModelToken(Theme.name), useValue: model },
      ],
    }).compile();

    service = module.get<ThemesService>(ThemesService);
  });

  describe('create', () => {
    it('should create a theme', async () => {
      const dto = { slug: 'dogs', label: 'Dogs', sortOrder: 0 };
      model.create.mockResolvedValue(mockTheme);

      const result = await service.create(dto);

      expect(model.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTheme);
    });
  });

  describe('findAll', () => {
    it('should return all themes sorted by sortOrder then label', async () => {
      const chainable = { sort: jest.fn().mockResolvedValue([mockTheme]) };
      model.find.mockReturnValue(chainable);

      const result = await service.findAll();

      expect(chainable.sort).toHaveBeenCalledWith({ sortOrder: 1, label: 1 });
      expect(result).toEqual([mockTheme]);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated data with total count', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockTheme]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAllPaginated(1, 10);

      expect(chainable.skip).toHaveBeenCalledWith(0);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [mockTheme], total: 1 });
    });

    it('should calculate correct skip for page 2', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(0);

      await service.findAllPaginated(2, 10);

      expect(chainable.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('findById', () => {
    it('should find theme by id', async () => {
      model.findById.mockResolvedValue(mockTheme);

      const result = await service.findById('theme-1');

      expect(model.findById).toHaveBeenCalledWith('theme-1');
      expect(result).toEqual(mockTheme);
    });

    it('should return null when not found', async () => {
      model.findById.mockResolvedValue(null);

      const result = await service.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findBySlugExists', () => {
    it('should return true when slug exists', async () => {
      model.exists.mockReturnValue(Promise.resolve({ _id: 'theme-1' }));

      const result = await service.findBySlugExists('dogs');

      expect(result).toBe(true);
    });

    it('should return false when slug does not exist', async () => {
      model.exists.mockReturnValue(Promise.resolve(null));

      const result = await service.findBySlugExists('missing');

      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update theme and return updated doc', async () => {
      const updated = { ...mockTheme, label: 'Doggos' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.update('theme-1', { label: 'Doggos' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'theme-1',
        { label: 'Doggos' },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should return null when not found', async () => {
      model.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.update('missing', { label: 'X' });

      expect(result).toBeNull();
    });
  });

  describe('upsertById', () => {
    it('upserts by id with setDefaultsOnInsert', async () => {
      const seed = { slug: 'dogs', label: 'Dogs', sortOrder: 1 };
      model.findByIdAndUpdate.mockResolvedValue({ id: 'theme-1', ...seed });

      const result = await service.upsertById('theme-1', seed);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('theme-1', seed, {
        upsert: true,
        setDefaultsOnInsert: true,
        new: true,
      });
      expect(result).toEqual({ id: 'theme-1', ...seed });
    });
  });

  describe('remove', () => {
    it('should delete theme by id', async () => {
      model.findByIdAndDelete.mockResolvedValue(mockTheme);

      await service.remove('theme-1');

      expect(model.findByIdAndDelete).toHaveBeenCalledWith('theme-1');
    });
  });
});

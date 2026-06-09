import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AllowlistService } from './allowlist.service';
import { AllowlistEntry } from './schemas/allowlist-entry.schema';

describe('AllowlistService', () => {
  let service: AllowlistService;
  let model: Record<string, jest.Mock>;

  const mockEntry = {
    id: 'entry-1',
    value: 'alice@example.com',
    note: 'Founder',
  };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      countDocuments: jest.fn(),
      estimatedDocumentCount: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllowlistService,
        { provide: getModelToken(AllowlistEntry.name), useValue: model },
      ],
    }).compile();

    service = module.get<AllowlistService>(AllowlistService);
  });

  describe('create', () => {
    it('should create an allowlist entry', async () => {
      const dto = { value: 'alice@example.com', note: 'Founder' };
      model.create.mockResolvedValue(mockEntry);

      const result = await service.create(dto);

      expect(model.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockEntry);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated entries newest first with total', async () => {
      const chainable = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockEntry]),
      };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAllPaginated(2, 10);

      expect(chainable.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(chainable.skip).toHaveBeenCalledWith(10);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [mockEntry], total: 1 });
    });
  });

  describe('findByValueExists', () => {
    it('should return true when an entry exists', async () => {
      model.exists.mockResolvedValue({ _id: 'entry-1' });

      const result = await service.findByValueExists('alice@example.com');

      expect(model.exists).toHaveBeenCalledWith({ value: 'alice@example.com' });
      expect(result).toBe(true);
    });

    it('should return false when no entry exists', async () => {
      model.exists.mockResolvedValue(null);

      const result = await service.findByValueExists('nobody@example.com');

      expect(result).toBe(false);
    });
  });

  describe('isEmailAllowed', () => {
    it('should allow any email when the collection is empty', async () => {
      model.estimatedDocumentCount.mockResolvedValue(0);

      const result = await service.isEmailAllowed('anyone@example.com');

      expect(result).toBe(true);
      expect(model.exists).not.toHaveBeenCalled();
    });

    it('should match an email by exact value or its domain', async () => {
      model.estimatedDocumentCount.mockResolvedValue(3);
      model.exists.mockResolvedValue({ _id: 'entry-1' });

      const result = await service.isEmailAllowed('Bob@Example.com');

      expect(model.exists).toHaveBeenCalledWith({
        value: { $in: ['bob@example.com', '@example.com'] },
      });
      expect(result).toBe(true);
    });

    it('should reject an email that matches nothing', async () => {
      model.estimatedDocumentCount.mockResolvedValue(3);
      model.exists.mockResolvedValue(null);

      const result = await service.isEmailAllowed('stranger@other.com');

      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete an entry by id', async () => {
      model.findByIdAndDelete.mockResolvedValue(mockEntry);

      await service.remove('entry-1');

      expect(model.findByIdAndDelete).toHaveBeenCalledWith('entry-1');
    });
  });
});

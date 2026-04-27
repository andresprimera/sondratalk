import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;
  let model: Record<string, jest.Mock>;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
  };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: model },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a user', async () => {
      const data = { name: 'Test', email: 'test@example.com', password: 'hash', role: 'user' };
      model.create.mockResolvedValue(mockUser);

      const result = await service.create(data);

      expect(model.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockUser);
    });
  });

  describe('countUsers', () => {
    it('should return the user count', async () => {
      model.countDocuments.mockResolvedValue(5);

      const result = await service.countUsers();

      expect(result).toBe(5);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      model.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([mockUser]);
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated data with total count', async () => {
      const chainable = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([mockUser]) };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(1);

      const result = await service.findAllPaginated(1, 10);

      expect(chainable.skip).toHaveBeenCalledWith(0);
      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [mockUser], total: 1 });
    });

    it('should calculate correct skip for page 2', async () => {
      const chainable = { skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) };
      model.find.mockReturnValue(chainable);
      model.countDocuments.mockResolvedValue(0);

      await service.findAllPaginated(2, 10);

      expect(chainable.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email with password selected', async () => {
      const chainable = { select: jest.fn().mockResolvedValue(mockUser) };
      model.findOne.mockReturnValue(chainable);

      const result = await service.findByEmail('test@example.com');

      expect(model.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(chainable.select).toHaveBeenCalledWith('+password');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      model.findById.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(model.findById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateRole', () => {
    it('should update user role and return updated user', async () => {
      const updated = { ...mockUser, role: 'admin' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateRole('user-1', 'admin');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', { role: 'admin' }, { new: true });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by id', async () => {
      model.findByIdAndDelete.mockResolvedValue(mockUser);

      await service.deleteUser('user-1');

      expect(model.findByIdAndDelete).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateRefreshToken', () => {
    it('should update the hashed refresh token', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.updateRefreshToken('user-1', 'hashed-token');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        hashedRefreshToken: 'hashed-token',
      });
    });

    it('should set refresh token to null on logout', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.updateRefreshToken('user-1', null);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        hashedRefreshToken: null,
      });
    });
  });

  describe('findByIdWithRefreshToken', () => {
    it('should find user with refresh token selected', async () => {
      const chainable = { select: jest.fn().mockResolvedValue(mockUser) };
      model.findById.mockReturnValue(chainable);

      const result = await service.findByIdWithRefreshToken('user-1');

      expect(chainable.select).toHaveBeenCalledWith('+hashedRefreshToken');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmailExists', () => {
    it('should return true when user exists', async () => {
      model.exists.mockReturnValue(Promise.resolve({ _id: 'user-1' }));

      const result = await service.findByEmailExists('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      model.exists.mockReturnValue(Promise.resolve(null));

      const result = await service.findByEmailExists('nobody@example.com');

      expect(result).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('should update name and email', async () => {
      const updated = { ...mockUser, name: 'New Name' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', { name: 'New Name', email: 'test@example.com' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { name: 'New Name', email: 'test@example.com' },
        { new: true },
      );
      expect(result).toEqual(updated);
    });
  });

  describe('updatePassword', () => {
    it('should update the password hash', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.updatePassword('user-1', 'new-hash');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        password: 'new-hash',
      });
    });
  });

  describe('clearPasswordResetToken', () => {
    it('should unset password reset fields', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.clearPasswordResetToken('user-1');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        $unset: { hashedPasswordResetToken: 1, passwordResetExpires: 1 },
      });
    });
  });
});

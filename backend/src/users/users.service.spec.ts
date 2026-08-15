import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User, UserDocument } from './schemas/user.schema';
import { AvailabilityService } from '../availability/availability.service';
import { MembershipsService } from '../memberships/memberships.service';

describe('UsersService', () => {
  let service: UsersService;
  let model: Record<string, jest.Mock>;
  let availabilityService: { findAvailableNowPaginated: jest.Mock };
  let membershipsService: { findCirclesForUsers: jest.Mock };

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
      updateOne: jest.fn(),
      aggregate: jest.fn(),
    };
    availabilityService = { findAvailableNowPaginated: jest.fn() };
    membershipsService = { findCirclesForUsers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: model },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: MembershipsService, useValue: membershipsService },
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

  describe('findAllPaginatedForAdmin', () => {
    const aggRow = { ...mockUser, hostExp: 2, createdAt: new Date(), conversationCount: 3 };

    it('maps aggregate rows with conversationCount', async () => {
      model.aggregate.mockResolvedValue([
        { data: [aggRow], total: [{ n: 1 }] },
      ]);

      const result = await service.findAllPaginatedForAdmin(1, 10);

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ conversationCount: 3 });
    });

    it('passes correct skip and limit via $facet', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(3, 5);

      const pipeline = model.aggregate.mock.calls[0][0];
      const facet = pipeline.find((s: Record<string, unknown>) => '$facet' in s);
      expect(facet.$facet.data[0].$skip).toBe(10);
      expect(facet.$facet.data[1].$limit).toBe(5);
    });

    it('returns empty data and zero total when aggregate yields no result', async () => {
      model.aggregate.mockResolvedValue([]);

      const result = await service.findAllPaginatedForAdmin(1, 10);

      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('omits the $match stage when q is not provided', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(1, 10);

      const pipeline = model.aggregate.mock.calls[0][0];
      expect(pipeline.some((s: Record<string, unknown>) => '$match' in s)).toBe(
        false,
      );
    });

    it('filters by a case-insensitive name/email match when q is provided', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(1, 10, 'name', 'asc', 'jane');

      const pipeline = model.aggregate.mock.calls[0][0];
      const match = pipeline[0];
      expect(match.$match.$or).toEqual([
        { name: { $regex: 'jane', $options: 'i' } },
        { email: { $regex: 'jane', $options: 'i' } },
      ]);
    });

    it('escapes regex metacharacters in q so they are matched literally', async () => {
      model.aggregate.mockResolvedValue([{ data: [], total: [{ n: 0 }] }]);

      await service.findAllPaginatedForAdmin(1, 10, 'name', 'asc', 'a.b+c');

      const pipeline = model.aggregate.mock.calls[0][0];
      const match = pipeline[0];
      expect(match.$match.$or[0].name.$regex).toBe('a\\.b\\+c');
    });
  });

  describe('findAvailableNowWithCircles', () => {
    it('joins the live pool with users and circles, preserving presence order', async () => {
      const id1 = new Types.ObjectId();
      const id2 = new Types.ObjectId();
      availabilityService.findAvailableNowPaginated.mockResolvedValue({
        userIds: [id1, id2],
        total: 2,
      });
      const user1 = { id: id1.toString(), name: 'A' } as unknown as UserDocument;
      const user2 = { id: id2.toString(), name: 'B' } as unknown as UserDocument;
      // findByIds resolves in a different order to prove we re-sort by presence.
      model.find.mockResolvedValue([user2, user1]);
      const circle = { id: 'c1' };
      membershipsService.findCirclesForUsers.mockResolvedValue(
        new Map([[id1.toString(), [circle]]]),
      );

      const result = await service.findAvailableNowWithCircles(1, 10);

      const [freshSince, skip, limit] =
        availabilityService.findAvailableNowPaginated.mock.calls[0];
      expect(freshSince).toBeInstanceOf(Date);
      expect(skip).toBe(0);
      expect(limit).toBe(10);
      expect(result.total).toBe(2);
      expect(result.data.map((r) => r.user)).toEqual([user1, user2]);
      expect(result.data[0].circles).toEqual([circle]);
      expect(result.data[1].circles).toEqual([]);
    });

    it('short-circuits without user/circle queries when the pool is empty', async () => {
      availabilityService.findAvailableNowPaginated.mockResolvedValue({
        userIds: [],
        total: 0,
      });

      const result = await service.findAvailableNowWithCircles(2, 5);

      expect(result).toEqual({ data: [], total: 0 });
      expect(model.find).not.toHaveBeenCalled();
      expect(membershipsService.findCirclesForUsers).not.toHaveBeenCalled();
      // page 2, limit 5 → skip 5
      expect(
        availabilityService.findAvailableNowPaginated.mock.calls[0][1],
      ).toBe(5);
    });

    it('skips users that vanished between the presence read and the join', async () => {
      const id1 = new Types.ObjectId();
      const id2 = new Types.ObjectId();
      availabilityService.findAvailableNowPaginated.mockResolvedValue({
        userIds: [id1, id2],
        total: 2,
      });
      const user1 = { id: id1.toString() } as unknown as UserDocument;
      model.find.mockResolvedValue([user1]);
      membershipsService.findCirclesForUsers.mockResolvedValue(new Map());

      const result = await service.findAvailableNowWithCircles(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].user).toBe(user1);
      expect(result.total).toBe(2);
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

  describe('updateLanguages', () => {
    it('replaces languages and locale, returning the updated doc', async () => {
      const languages = [
        { code: 'es', fluency: 'Native' as const },
        { code: 'en', fluency: 'Fluent' as const },
      ];
      const updated = { ...mockUser, languages, locale: 'es' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateLanguages('user-1', languages, 'es');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { languages, locale: 'es' },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('returns null when the user does not exist', async () => {
      model.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.updateLanguages('missing', [], 'en');

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete user by id', async () => {
      model.findByIdAndDelete.mockResolvedValue(mockUser);

      await service.remove('user-1');

      expect(model.findByIdAndDelete).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findByIdWithSessions', () => {
    it('should find user with sessions selected', async () => {
      const chainable = { select: jest.fn().mockResolvedValue(mockUser) };
      model.findById.mockReturnValue(chainable);

      const result = await service.findByIdWithSessions('user-1');

      expect(chainable.select).toHaveBeenCalledWith('+sessions');
      expect(result).toEqual(mockUser);
    });
  });

  describe('addSession', () => {
    const session = {
      jti: 'jti-1',
      hashedToken: 'hashed',
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    it('prunes expired sessions then pushes the new one capped at maxSessions', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.addSession('user-1', session, 10, 30 * 24 * 60 * 60 * 1000);

      const [firstCall, secondCall] = model.findByIdAndUpdate.mock.calls;
      expect(firstCall[0]).toBe('user-1');
      expect(firstCall[1].$pull.sessions.lastUsedAt.$lt).toBeInstanceOf(Date);
      expect(secondCall[0]).toBe('user-1');
      expect(secondCall[1]).toEqual({
        $push: { sessions: { $each: [session], $slice: -10 } },
      });
    });
  });

  describe('rotateSession', () => {
    it('updates hashedToken and lastUsedAt for the matched session', async () => {
      model.updateOne.mockResolvedValue(undefined);

      await service.rotateSession('user-1', 'jti-1', 'new-hash');

      const [filter, update] = model.updateOne.mock.calls[0];
      expect(filter).toEqual({ _id: 'user-1', 'sessions.jti': 'jti-1' });
      expect(update.$set['sessions.$.hashedToken']).toBe('new-hash');
      expect(update.$set['sessions.$.lastUsedAt']).toBeInstanceOf(Date);
    });
  });

  describe('removeSession', () => {
    it('pulls the session matching the jti', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.removeSession('user-1', 'jti-1');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        $pull: { sessions: { jti: 'jti-1' } },
      });
    });
  });

  describe('removeAllSessions', () => {
    it('clears the sessions array', async () => {
      model.findByIdAndUpdate.mockResolvedValue(undefined);

      await service.removeAllSessions('user-1');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
        sessions: [],
      });
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

  describe('updateTimezone', () => {
    it('updates only the timezone field when no city is provided', async () => {
      const updated = { ...mockUser, timezone: 'Europe/Madrid' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateTimezone('user-1', 'Europe/Madrid');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { timezone: 'Europe/Madrid' },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('updates timezone and city when city is provided', async () => {
      const updated = { ...mockUser, timezone: 'Europe/Madrid', city: 'Barcelona' };
      model.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateTimezone('user-1', 'Europe/Madrid', 'Barcelona');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { timezone: 'Europe/Madrid', city: 'Barcelona' },
        { new: true },
      );
      expect(result).toEqual(updated);
    });
  });

  describe('updateApplication', () => {
    it('saves applicationText and returns the updated doc', async () => {
      model.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.updateApplication('user-1', 'I want to connect');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-1',
        { applicationText: 'I want to connect' },
        { new: true },
      );
      expect(result).toEqual(mockUser);
    });

    it('returns null when the user does not exist', async () => {
      model.findByIdAndUpdate.mockResolvedValue(null);

      const result = await service.updateApplication('missing', 'text');

      expect(result).toBeNull();
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

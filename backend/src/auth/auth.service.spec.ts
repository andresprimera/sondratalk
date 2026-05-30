import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../services';
import { AvailabilityService } from '../availability/availability.service';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockSession = {
  jti: 'session-jti',
  hashedToken: 'hashed-refresh-token',
  createdAt: new Date(),
  lastUsedAt: new Date(),
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  timezone: 'UTC',
  password: 'hashed-password',
  sessions: [mockSession],
  hashedPasswordResetToken: 'hashed-reset-token',
  passwordResetExpires: new Date(Date.now() + 3600_000),
  createdAt: new Date('2024-03-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findByEmail: jest.fn(),
    countUsers: jest.fn(),
    create: jest.fn(),
    findByIdWithSessions: jest.fn(),
    addSession: jest.fn(),
    rotateSession: jest.fn(),
    removeSession: jest.fn(),
    removeAllSessions: jest.fn(),
    findByEmailWithResetToken: jest.fn(),
    updatePasswordResetToken: jest.fn(),
    clearPasswordResetToken: jest.fn(),
    updatePassword: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn(),
  };

  const mailService = {
    sendMail: jest.fn(),
  };

  const availabilityService = {
    clearAvailableNow: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
        { provide: AvailabilityService, useValue: availabilityService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jwtService.signAsync.mockResolvedValue('mock-token');
    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
      return 'mock-secret';
    });
    mockedBcrypt.hash.mockResolvedValue('hashed-value' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
  });

  describe('signup', () => {
    const dto = {
      name: 'Test',
      email: 'test@example.com',
      password: 'Password1!',
      timezone: 'UTC',
    };

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('should assign admin role to the first user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.countUsers.mockResolvedValue(0);
      usersService.create.mockResolvedValue(mockUser);

      await service.signup(dto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });

    it('should assign user role to subsequent users', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.countUsers.mockResolvedValue(5);
      usersService.create.mockResolvedValue(mockUser);

      await service.signup(dto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user' }),
      );
    });

    it('should return tokens and user data on successful signup', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.countUsers.mockResolvedValue(0);
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.signup(dto);

      expect(result).toEqual({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          timezone: 'UTC',
          languages: [],
          locale: 'en',
          createdAt: '2024-03-01T00:00:00.000Z',
        },
      });
    });

    it('should hash the password before storing', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.countUsers.mockResolvedValue(0);
      usersService.create.mockResolvedValue(mockUser);

      await service.signup(dto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('Password1!', 12);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-value' }),
      );
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'Password1!' };

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should store a new session after login', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await service.login(dto);

      expect(usersService.addSession).toHaveBeenCalledTimes(1);
      const [userId, session, maxSessions, ttlMs] =
        usersService.addSession.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(session.jti).toEqual(expect.any(String));
      expect(session.hashedToken).toBe('hashed-value');
      expect(maxSessions).toBe(10);
      expect(ttlMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if jti is missing', async () => {
      await expect(
        service.refreshTokens('user-1', undefined, 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByIdWithSessions.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-1', 'session-jti', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if session not found for jti', async () => {
      usersService.findByIdWithSessions.mockResolvedValue({
        ...mockUser,
        sessions: [],
      });

      await expect(
        service.refreshTokens('user-1', 'session-jti', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token does not match', async () => {
      usersService.findByIdWithSessions.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.refreshTokens('user-1', 'session-jti', 'bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate the session and return new tokens on valid refresh', async () => {
      usersService.findByIdWithSessions.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.refreshTokens(
        'user-1',
        'session-jti',
        'valid-token',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe('user-1');
      expect(usersService.rotateSession).toHaveBeenCalledWith(
        'user-1',
        'session-jti',
        'hashed-value',
      );
    });
  });

  describe('logout', () => {
    it('should remove only the current session', async () => {
      await service.logout('user-1', 'session-jti');

      expect(usersService.removeSession).toHaveBeenCalledWith(
        'user-1',
        'session-jti',
      );
    });

    it('clears the user out of live matching on logout', async () => {
      await service.logout('user-1', 'session-jti');

      expect(availabilityService.clearAvailableNow).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('is a no-op when jti is missing', async () => {
      await service.logout('user-1', undefined);

      expect(usersService.removeSession).not.toHaveBeenCalled();
      expect(availabilityService.clearAvailableNow).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should silently return if user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'nobody@example.com' })).resolves.toBeUndefined();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('should send reset email if user exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mailService.sendMail.mockResolvedValue(undefined);

      await service.forgotPassword({ email: 'test@example.com' });

      expect(usersService.updatePasswordResetToken).toHaveBeenCalled();
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Password Reset Request',
        }),
      );
    });

    it('should silently return on cooldown without sending email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      mailService.sendMail.mockResolvedValue(undefined);

      await service.forgotPassword({ email: 'test@example.com' });
      await service.forgotPassword({ email: 'test@example.com' });

      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    const dto = { email: 'test@example.com', token: 'reset-token', password: 'NewPass1!' };

    it('should throw BadRequestException if user not found', async () => {
      usersService.findByEmailWithResetToken.mockResolvedValue(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reset token is expired', async () => {
      usersService.findByEmailWithResetToken.mockResolvedValue({
        ...mockUser,
        passwordResetExpires: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(usersService.clearPasswordResetToken).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token does not match', async () => {
      usersService.findByEmailWithResetToken.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });

    it('should update password and clear reset token + all sessions on success', async () => {
      usersService.findByEmailWithResetToken.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.resetPassword(dto);

      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'hashed-value');
      expect(usersService.clearPasswordResetToken).toHaveBeenCalledWith('user-1');
      expect(usersService.removeAllSessions).toHaveBeenCalledWith('user-1');
    });
  });
});

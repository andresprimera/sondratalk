import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import ms, { type StringValue } from 'ms';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { toUser } from '../users/users.mapper';
import { MailService } from '../services';
import { AvailabilityService } from '../availability/availability.service';
import { AllowlistService } from '../allowlist/allowlist.service';
import { type SignupInput } from './dto/signup.dto';
import { type LoginInput } from './dto/login.dto';
import { type ForgotPasswordInput } from './dto/forgot-password.dto';
import { type ResetPasswordInput } from './dto/reset-password.dto';
import { type AuthResponse, type LocaleKey } from '@base-dashboard/shared';
import { PASSWORD_RESET_EMAIL_COPY } from './password-reset-email';

const MAX_SESSIONS_PER_USER = 10;

@Injectable()
export class AuthService {
  private readonly forgotPasswordCooldowns = new Map<string, number>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private availabilityService: AvailabilityService,
    private allowlistService: AllowlistService,
  ) {}

  async signup(dto: SignupInput): Promise<AuthResponse> {
    // The very first user bootstraps the app as admin and is exempt from the
    // allowlist (there is no one to maintain it yet). Every signup after that
    // must be on the early-access allowlist — an empty allowlist blocks all.
    const userCount = await this.usersService.countUsers();
    const isFirstUser = userCount === 0;

    if (
      !isFirstUser &&
      !(await this.allowlistService.isEmailAllowed(dto.email))
    ) {
      throw new ForbiddenException(
        "This email isn't on the early access list. Sondra is invite-only right now.",
      );
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const role = isFirstUser ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
      role,
    });

    const jti = crypto.randomUUID();
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      jti,
    );
    await this.addStoredSession(user.id, jti, tokens.refreshToken);

    return {
      ...tokens,
      user: toUser(user),
    };
  }

  async login(dto: LoginInput): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const jti = crypto.randomUUID();
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      jti,
    );
    await this.addStoredSession(user.id, jti, tokens.refreshToken);

    return {
      ...tokens,
      user: toUser(user),
    };
  }

  async refreshTokens(
    userId: string,
    jti: string | undefined,
    refreshToken: string,
  ): Promise<AuthResponse> {
    if (!jti) {
      throw new UnauthorizedException('Access denied');
    }

    const user = await this.usersService.findByIdWithSessions(userId);
    if (!user) {
      throw new UnauthorizedException('Access denied');
    }

    const session = user.sessions.find((s) => s.jti === jti);
    if (!session) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, session.hashedToken);
    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      jti,
    );
    const hashedToken = await bcrypt.hash(tokens.refreshToken, 12);
    await this.usersService.rotateSession(user.id, jti, hashedToken);

    return {
      ...tokens,
      user: toUser(user),
    };
  }

  async logout(userId: string, jti: string | undefined): Promise<void> {
    if (!jti) return;
    await this.usersService.removeSession(userId, jti);
    // Sticky "Go online" toggles outlive the session otherwise — clearing
    // here keeps the user out of matching until they explicitly come back.
    await this.availabilityService.clearAvailableNow(userId);
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    jti: string,
  ) {
    const payload = { sub: userId, email, role, jti };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // eslint-disable-next-line no-restricted-syntax
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRATION',
        ) as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        // eslint-disable-next-line no-restricted-syntax
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRATION',
        ) as StringValue,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async forgotPassword(dto: ForgotPasswordInput): Promise<void> {
    const lastRequest = this.forgotPasswordCooldowns.get(dto.email);
    if (lastRequest && Date.now() - lastRequest < 60_000) {
      return;
    }
    this.forgotPasswordCooldowns.set(dto.email, Date.now());

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 12);
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.updatePasswordResetToken(
      user.id,
      hashedToken,
      expires,
    );

    const frontendUrl =
      this.configService.getOrThrow<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Send the reset email in the user's own language (the meeting/scheduling
    // emails already do this); fall back to English for any other value.
    const locale: LocaleKey = user.locale === 'es' ? 'es' : 'en';
    const copy = PASSWORD_RESET_EMAIL_COPY[locale];

    await this.mailService.sendMail({
      to: user.email,
      subject: copy.subject,
      html: copy.bodyHtml(resetUrl),
      text: copy.bodyText(resetUrl),
    });
  }

  async resetPassword(dto: ResetPasswordInput): Promise<void> {
    const user = await this.usersService.findByEmailWithResetToken(dto.email);

    if (
      !user ||
      !user.hashedPasswordResetToken ||
      !user.passwordResetExpires
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.passwordResetExpires < new Date()) {
      await this.usersService.clearPasswordResetToken(user.id);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const tokenValid = await bcrypt.compare(
      dto.token,
      user.hashedPasswordResetToken,
    );
    if (!tokenValid) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearPasswordResetToken(user.id);
    await this.usersService.removeAllSessions(user.id);
  }

  private async addStoredSession(
    userId: string,
    jti: string,
    refreshToken: string,
  ) {
    const hashedToken = await bcrypt.hash(refreshToken, 12);
    const now = new Date();
    // eslint-disable-next-line no-restricted-syntax
    const refreshTtl = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRATION',
    ) as StringValue;
    const refreshTtlMs = ms(refreshTtl);
    await this.usersService.addSession(
      userId,
      { jti, hashedToken, createdAt: now, lastUsedAt: now },
      MAX_SESSIONS_PER_USER,
      refreshTtlMs,
    );
  }
}

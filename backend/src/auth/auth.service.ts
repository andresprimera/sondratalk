import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { type StringValue } from 'ms';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../services';
import { type SignupInput } from './dto/signup.dto';
import { type LoginInput } from './dto/login.dto';
import { type ForgotPasswordInput } from './dto/forgot-password.dto';
import { type ResetPasswordInput } from './dto/reset-password.dto';
import { type AuthResponse, type Role } from '@base-dashboard/shared';

@Injectable()
export class AuthService {
  private readonly forgotPasswordCooldowns = new Map<string, number>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async signup(dto: SignupInput): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const userCount = await this.usersService.countUsers();
    const role = userCount === 0 ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
      role,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateStoredRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as Role, timezone: user.timezone },
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

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateStoredRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as Role, timezone: user.timezone },
    };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateStoredRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as Role, timezone: user.timezone },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRATION') as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRATION') as StringValue,
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

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset.</p>
             <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
             <p>This link expires in 1 hour.</p>
             <p>If you did not request this, ignore this email.</p>`,
      text: `You requested a password reset. Visit this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
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
    await this.usersService.updateRefreshToken(user.id, null);
  }

  private async updateStoredRefreshToken(
    userId: string,
    refreshToken: string,
  ) {
    const hashed = await bcrypt.hash(refreshToken, 12);
    await this.usersService.updateRefreshToken(userId, hashed);
  }
}

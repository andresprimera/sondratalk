import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { MembershipsService } from '../memberships/memberships.service';
import { AvailabilityService } from '../availability/availability.service';
import { toAvailability } from '../availability/availability.mapper';
import { toCircle } from '../circles/circle.mapper';
import { toUser } from './users.mapper';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  updateUserRoleSchema,
  type UpdateUserRoleInput,
  type Availability,
  type Circle,
  type PaginatedResponse,
  type User,
  updateAvailabilitySchema,
  type UpdateAvailabilityInput,
  updateTimezoneSchema,
  type UpdateTimezoneInput,
  updateLanguagesSchema,
  type UpdateLanguagesInput,
  updateApplicationSchema,
  type UpdateApplicationInput,
  type FoundingMembersCount,
} from '@base-dashboard/shared';
import {
  paginationQuerySchema,
  type PaginationQuery,
} from '../common/dto/pagination-query.dto';
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from './dto/update-profile.dto';
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from './dto/change-password.dto';
import {
  createUserSchema,
  type CreateUserInput,
} from './dto/create-user.dto';
import {
  updateMyCirclesSchema,
  type UpdateMyCirclesInput,
} from '../memberships/dto';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private membershipsService: MembershipsService,
    private availabilityService: AvailabilityService,
  ) {}

  // --- Public endpoints ---

  @Public()
  @Get('count')
  async getFoundingMembersCount(): Promise<FoundingMembersCount> {
    const count = await this.usersService.countUsers();
    return { count };
  }

  // --- Current user endpoints (all authenticated users) ---

  @Get('me')
  async getMe(@CurrentUser('userId') userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ): Promise<User> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Email already in use');
    }
    const user = await this.usersService.updateProfile(userId, dto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Patch('me/timezone')
  async updateTimezone(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateTimezoneSchema))
    dto: UpdateTimezoneInput,
  ): Promise<User> {
    const user = await this.usersService.updateTimezone(userId, dto.timezone, dto.city);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Patch('me/languages')
  async updateLanguages(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateLanguagesSchema))
    dto: UpdateLanguagesInput,
  ): Promise<User> {
    const user = await this.usersService.updateLanguages(
      userId,
      dto.languages,
      dto.locale,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Patch('me/application')
  async updateApplication(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateApplicationSchema))
    dto: UpdateApplicationInput,
  ): Promise<User> {
    const user = await this.usersService.updateApplication(
      userId,
      dto.applicationText,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.updatePassword(userId, hashedPassword);
  }

  @Get('me/circles')
  async getMyCircles(
    @CurrentUser('userId') userId: string,
  ): Promise<Circle[]> {
    const docs = await this.membershipsService.findCirclesForUser(userId);
    return docs.map(toCircle);
  }

  @Put('me/circles')
  async updateMyCircles(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateMyCirclesSchema))
    dto: UpdateMyCirclesInput,
  ): Promise<Circle[]> {
    const docs = await this.membershipsService.replaceCirclesForUser(
      userId,
      dto.circleIds,
    );
    return docs.map(toCircle);
  }

  @Get('me/availability')
  async getMyAvailability(
    @CurrentUser('userId') userId: string,
  ): Promise<Availability> {
    const doc = await this.availabilityService.findByUserId(userId);
    return toAvailability(doc);
  }

  @Patch('me/availability')
  async updateMyAvailability(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(updateAvailabilitySchema))
    dto: UpdateAvailabilityInput,
  ): Promise<Availability> {
    const doc = await this.availabilityService.upsertByUserId(userId, dto);
    return toAvailability(doc);
  }

  @Post('me/availability/heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeatMyAvailability(
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.availabilityService.touchAvailableNow(userId);
  }

  // --- Admin-only endpoints ---

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserInput,
  ): Promise<User> {
    const existingUser = await this.usersService.findByEmailExists(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });
    return toUser(user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQuery,
  ): Promise<PaginatedResponse<User>> {
    const { data, total } = await this.usersService.findAllPaginated(
      query.page,
      query.limit,
    );
    return {
      data: data.map(toUser),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) dto: UpdateUserRoleInput,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<User> {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }
    const user = await this.usersService.updateRole(id, dto.role);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUser(user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('userId') currentUserId: string,
  ): Promise<void> {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    await this.usersService.remove(id);
  }
}

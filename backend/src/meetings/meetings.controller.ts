import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createMeetingSchema,
  type CreateMeetingInput,
  type Meeting,
  type MeetingWithPeer,
  type UpcomingMeetingsResponse,
  type ConversationStats,
  type AdminMeeting,
} from './dto';
import {
  paginationQuerySchema,
  type PaginationQuery,
} from '../common/dto/pagination-query.dto';
import { type PaginatedResponse } from '@base-dashboard/shared';
import { toMeeting } from './meetings.mapper';

@Controller('meetings')
export class MeetingsController {
  constructor(private meetingsService: MeetingsService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createMeetingSchema))
    dto: CreateMeetingInput,
  ): Promise<Meeting> {
    const doc = await this.meetingsService.create(userId, dto);
    return toMeeting(doc);
  }

  @Get('upcoming')
  async getUpcoming(
    @CurrentUser('userId') userId: string,
  ): Promise<UpcomingMeetingsResponse> {
    const meetings = await this.meetingsService.findUpcomingForUser(userId);
    return { meetings };
  }

  @Get('stats')
  async getStats(
    @CurrentUser('userId') userId: string,
  ): Promise<ConversationStats> {
    const conversations =
      await this.meetingsService.countConversationsForUser(userId);
    return { conversations };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAllForAdmin(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<AdminMeeting>> {
    const { data, total } = await this.meetingsService.findAllForAdmin(
      query.page,
      query.limit,
    );
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ): Promise<MeetingWithPeer> {
    return this.meetingsService.findByIdWithPeerForParticipant(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.meetingsService.cancel(userId, id);
  }
}

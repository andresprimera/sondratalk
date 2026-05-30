import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createMeetingSchema,
  type CreateMeetingInput,
  type Meeting,
  type MeetingWithPeer,
  type UpcomingMeetingsResponse,
  type ConversationStats,
} from './dto';
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

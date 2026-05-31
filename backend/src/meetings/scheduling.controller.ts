import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  proposeTimeSchema,
  respondToProposalSchema,
  type ProposeTimeInput,
  type RespondToProposalInput,
  type SchedulingThreadResponse,
} from './dto/scheduling';

@Controller('meetings/:meetingId/scheduling')
export class SchedulingController {
  constructor(private schedulingService: SchedulingService) {}

  @Get()
  async getThread(
    @CurrentUser('userId') userId: string,
    @Param('meetingId') meetingId: string,
  ): Promise<SchedulingThreadResponse> {
    return this.schedulingService.getThread(userId, meetingId);
  }

  @Post('proposals')
  async propose(
    @CurrentUser('userId') userId: string,
    @Param('meetingId') meetingId: string,
    @Body(new ZodValidationPipe(proposeTimeSchema)) dto: ProposeTimeInput,
  ): Promise<SchedulingThreadResponse> {
    return this.schedulingService.propose(userId, meetingId, dto.proposedAt);
  }

  @Post('responses')
  async respond(
    @CurrentUser('userId') userId: string,
    @Param('meetingId') meetingId: string,
    @Body(new ZodValidationPipe(respondToProposalSchema))
    dto: RespondToProposalInput,
  ): Promise<SchedulingThreadResponse> {
    return this.schedulingService.respond(
      userId,
      meetingId,
      dto.replyToId,
      dto.accept,
    );
  }
}

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  submitConversationFeedbackSchema,
  type AdminFeedback,
  type ConversationFeedback,
  type SubmitConversationFeedbackInput,
} from './dto';
import {
  paginationQuerySchema,
  type PaginationQuery,
} from '../common/dto/pagination-query.dto';
import { type PaginatedResponse } from '@base-dashboard/shared';
import { toConversationFeedback } from './feedback.mapper';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  async submit(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(submitConversationFeedbackSchema))
    dto: SubmitConversationFeedbackInput,
  ): Promise<ConversationFeedback> {
    const doc = await this.feedbackService.upsert(userId, dto);
    return toConversationFeedback(doc);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAll(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<PaginatedResponse<AdminFeedback>> {
    const { data, total } = await this.feedbackService.findAllForAdmin(
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
}

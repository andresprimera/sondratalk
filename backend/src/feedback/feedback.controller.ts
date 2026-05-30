import { Body, Controller, Post } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  submitConversationFeedbackSchema,
  type ConversationFeedback,
  type SubmitConversationFeedbackInput,
} from './dto';
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
}

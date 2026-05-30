import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConversationFeedback,
  ConversationFeedbackSchema,
} from './schemas/conversation-feedback.schema';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationFeedback.name, schema: ConversationFeedbackSchema },
    ]),
    MeetingsModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}

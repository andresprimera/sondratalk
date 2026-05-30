import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConversationFeedback,
  ConversationFeedbackDocument,
} from './schemas/conversation-feedback.schema';
import { MeetingsService } from '../meetings/meetings.service';
import type { SubmitConversationFeedbackInput } from './dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(ConversationFeedback.name)
    private feedbackModel: Model<ConversationFeedback>,
    private meetingsService: MeetingsService,
  ) {}

  // Upserts the (meeting, user) feedback document, merging only the fields
  // present in this submission. The wrap-up form and the "report an issue"
  // dialog both call this, so a later report must not wipe the survey answers
  // and vice versa.
  async upsert(
    userId: string,
    dto: SubmitConversationFeedbackInput,
  ): Promise<ConversationFeedbackDocument> {
    const { meetingId, ...rest } = dto;

    // Throws NotFound if the meeting doesn't exist or the user wasn't part of
    // it — keeps feedback tied to real conversations the user attended.
    await this.meetingsService.findByIdForParticipant(userId, meetingId);

    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) set[key] = value;
    }

    const doc = await this.feedbackModel.findOneAndUpdate(
      {
        meetingId: new Types.ObjectId(meetingId),
        userId: new Types.ObjectId(userId),
      },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    this.logger.log(
      `Saved conversation feedback meeting=${meetingId} user=${userId}` +
        (rest.report ? ' (with report)' : ''),
    );

    return doc;
  }
}

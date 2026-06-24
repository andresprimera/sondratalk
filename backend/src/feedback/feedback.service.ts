import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConversationFeedback,
  ConversationFeedbackDocument,
} from './schemas/conversation-feedback.schema';
import { MeetingsService } from '../meetings/meetings.service';
import { MatchExclusionsService } from '../match-exclusions/match-exclusions.service';
import type { AdminFeedback, SubmitConversationFeedbackInput } from './dto';

type AggRow = {
  _id: Types.ObjectId;
  meetingId: Types.ObjectId;
  userConversationIndex: number;
  userName: string;
  userEmail: string;
  talkAgain?: string;
  feeling?: string;
  circlesRelevant?: string;
  avQuality?: string;
  matchRating?: number;
  privateNotes?: string;
  report?: { reason: string; detail?: string };
  createdAt: Date;
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(ConversationFeedback.name)
    private feedbackModel: Model<ConversationFeedback>,
    private meetingsService: MeetingsService,
    private matchExclusionsService: MatchExclusionsService,
  ) {}

  // Upserts the (meeting, user) feedback document, merging only the fields
  // present in this submission. The wrap-up form and the "report an issue"
  // dialog both call this, so a later report must not wipe the survey answers
  // and vice versa.
  async upsert(
    userId: string,
    dto: SubmitConversationFeedbackInput,
  ): Promise<ConversationFeedbackDocument> {
    const { meetingId, dontMatchAgain, ...rest } = dto;

    // Throws NotFound if the meeting doesn't exist or the user wasn't part of
    // it — keeps feedback tied to real conversations the user attended.
    const meeting = await this.meetingsService.findByIdForParticipant(
      userId,
      meetingId,
    );

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

    // Kept in its own standalone collection (not a field on this document) so
    // it isn't tied to door-open's per-meeting lifecycle.
    if (dontMatchAgain) {
      const peerId = meeting.participants.find(
        (p) => p.toString() !== userId,
      );
      if (peerId) {
        await this.matchExclusionsService.create(userId, peerId.toString());
      }
    }

    return doc;
  }

  async findAllForAdmin(
    page: number,
    limit: number,
  ): Promise<{ data: AdminFeedback[]; total: number }> {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.feedbackModel.aggregate([
        { $sort: { userId: 1, createdAt: 1 } },
        {
          $setWindowFields: {
            partitionBy: '$userId',
            sortBy: { createdAt: 1 },
            output: { userConversationIndex: { $documentNumber: {} } },
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: false } },
        {
          $project: {
            _id: 1,
            meetingId: 1,
            userConversationIndex: 1,
            userName: '$userDoc.name',
            userEmail: '$userDoc.email',
            talkAgain: 1,
            feeling: 1,
            circlesRelevant: 1,
            avQuality: 1,
            matchRating: 1,
            privateNotes: 1,
            report: 1,
            createdAt: 1,
          },
        },
      ]),
      this.feedbackModel.countDocuments(),
    ]);

    return {
      // eslint-disable-next-line no-restricted-syntax
      data: (rows as AggRow[]).map((r): AdminFeedback => ({
        id: r._id.toString(),
        meetingId: r.meetingId.toString(),
        userConversationIndex: r.userConversationIndex,
        userName: r.userName,
        userEmail: r.userEmail,
        // eslint-disable-next-line no-restricted-syntax
        talkAgain: r.talkAgain as AdminFeedback['talkAgain'],
        feeling: r.feeling,
        // eslint-disable-next-line no-restricted-syntax
        circlesRelevant: r.circlesRelevant as AdminFeedback['circlesRelevant'],
        // eslint-disable-next-line no-restricted-syntax
        avQuality: r.avQuality as AdminFeedback['avQuality'],
        matchRating: r.matchRating,
        privateNotes: r.privateNotes,
        // eslint-disable-next-line no-restricted-syntax
        report: r.report as AdminFeedback['report'],
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }
}

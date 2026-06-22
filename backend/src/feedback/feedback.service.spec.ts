import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ConversationFeedback } from './schemas/conversation-feedback.schema';
import { MeetingsService } from '../meetings/meetings.service';
import { MatchExclusionsService } from '../match-exclusions/match-exclusions.service';

const MEETING_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';
const PEER_ID = '507f1f77bcf86cd799439099';

describe('FeedbackService', () => {
  let service: FeedbackService;
  const feedbackModel = {
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  };
  const meetingsService = {
    findByIdForParticipant: jest.fn(),
  };
  const matchExclusionsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getModelToken(ConversationFeedback.name),
          useValue: feedbackModel,
        },
        { provide: MeetingsService, useValue: meetingsService },
        {
          provide: MatchExclusionsService,
          useValue: matchExclusionsService,
        },
      ],
    }).compile();
    service = module.get<FeedbackService>(FeedbackService);
  });

  describe('upsert', () => {
    it('validates participation and upserts only the provided fields', async () => {
      const saved = { id: 'fb-1' };
      meetingsService.findByIdForParticipant.mockResolvedValue({});
      feedbackModel.findOneAndUpdate.mockResolvedValue(saved);

      const result = await service.upsert(USER_ID, {
        meetingId: MEETING_ID,
        talkAgain: 'yes',
        matchRating: 4,
      });

      expect(meetingsService.findByIdForParticipant).toHaveBeenCalledWith(
        USER_ID,
        MEETING_ID,
      );
      const [filter, update, options] =
        feedbackModel.findOneAndUpdate.mock.calls[0];
      expect(filter.meetingId.toString()).toBe(MEETING_ID);
      expect(filter.userId.toString()).toBe(USER_ID);
      // meetingId must not leak into the $set, and undefined fields are skipped.
      expect(update.$set).toEqual({ talkAgain: 'yes', matchRating: 4 });
      expect(options).toMatchObject({ upsert: true, new: true });
      expect(result).toBe(saved);
    });

    it('persists a report submission', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue({});
      feedbackModel.findOneAndUpdate.mockResolvedValue({ id: 'fb-2' });

      await service.upsert(USER_ID, {
        meetingId: MEETING_ID,
        report: { reason: 'unsafe', detail: 'made me uncomfortable' },
      });

      const [, update] = feedbackModel.findOneAndUpdate.mock.calls[0];
      expect(update.$set.report).toEqual({
        reason: 'unsafe',
        detail: 'made me uncomfortable',
      });
    });

    it('propagates NotFound when the user was not a participant', async () => {
      meetingsService.findByIdForParticipant.mockRejectedValue(
        new NotFoundException('Meeting not found'),
      );

      await expect(
        service.upsert(USER_ID, { meetingId: MEETING_ID, talkAgain: 'no' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(feedbackModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('creates a one-directional match exclusion when dontMatchAgain is true', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue({
        participants: [USER_ID, PEER_ID],
      });
      feedbackModel.findOneAndUpdate.mockResolvedValue({ id: 'fb-3' });

      await service.upsert(USER_ID, {
        meetingId: MEETING_ID,
        dontMatchAgain: true,
      });

      expect(matchExclusionsService.create).toHaveBeenCalledWith(
        USER_ID,
        PEER_ID,
      );
    });

    it('keeps dontMatchAgain out of the feedback document — it lives in its own table', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue({
        participants: [USER_ID, PEER_ID],
      });
      feedbackModel.findOneAndUpdate.mockResolvedValue({ id: 'fb-4' });

      await service.upsert(USER_ID, {
        meetingId: MEETING_ID,
        dontMatchAgain: true,
      });

      const [, update] = feedbackModel.findOneAndUpdate.mock.calls[0];
      expect(update.$set).not.toHaveProperty('dontMatchAgain');
    });

    it('does not create an exclusion when dontMatchAgain is omitted', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue({
        participants: [USER_ID, PEER_ID],
      });
      feedbackModel.findOneAndUpdate.mockResolvedValue({ id: 'fb-5' });

      await service.upsert(USER_ID, {
        meetingId: MEETING_ID,
        talkAgain: 'yes',
      });

      expect(matchExclusionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllForAdmin', () => {
    const mockAggRow = {
      _id: { toString: () => 'fb-1' },
      meetingId: { toString: () => MEETING_ID },
      userConversationIndex: 2,
      userName: 'Ana',
      userEmail: 'ana@example.com',
      talkAgain: 'yes',
      feeling: 'great',
      circlesRelevant: 'somewhat',
      avQuality: 'good',
      matchRating: 4,
      privateNotes: 'notes here',
      report: undefined,
      createdAt: new Date('2025-06-01T10:00:00Z'),
    };

    it('returns paginated admin feedback with mapped fields', async () => {
      feedbackModel.aggregate.mockResolvedValue([mockAggRow]);
      feedbackModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAllForAdmin(1, 10);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      const row = result.data[0];
      expect(row.id).toBe('fb-1');
      expect(row.meetingId).toBe(MEETING_ID);
      expect(row.userConversationIndex).toBe(2);
      expect(row.userName).toBe('Ana');
      expect(row.userEmail).toBe('ana@example.com');
      expect(row.talkAgain).toBe('yes');
      expect(row.feeling).toBe('great');
      expect(row.matchRating).toBe(4);
      expect(row.createdAt).toBe('2025-06-01T10:00:00.000Z');
    });

    it('passes correct skip and limit to the aggregate pipeline', async () => {
      feedbackModel.aggregate.mockResolvedValue([]);
      feedbackModel.countDocuments.mockResolvedValue(0);

      await service.findAllForAdmin(3, 10);

      const pipeline: object[] = feedbackModel.aggregate.mock.calls[0][0];
      const skipStage = pipeline.find(
        (s: object) => '$skip' in s,
      ) as { $skip: number } | undefined;
      const limitStage = pipeline.find(
        (s: object) => '$limit' in s,
      ) as { $limit: number } | undefined;
      expect(skipStage?.$skip).toBe(20);
      expect(limitStage?.$limit).toBe(10);
    });

    it('returns empty data when there are no feedback documents', async () => {
      feedbackModel.aggregate.mockResolvedValue([]);
      feedbackModel.countDocuments.mockResolvedValue(0);

      const result = await service.findAllForAdmin(1, 10);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});

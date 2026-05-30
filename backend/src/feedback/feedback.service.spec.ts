import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { ConversationFeedback } from './schemas/conversation-feedback.schema';
import { MeetingsService } from '../meetings/meetings.service';

const MEETING_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';

describe('FeedbackService', () => {
  let service: FeedbackService;
  const feedbackModel = {
    findOneAndUpdate: jest.fn(),
  };
  const meetingsService = {
    findByIdForParticipant: jest.fn(),
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
  });
});

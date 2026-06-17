import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SchedulingService } from './scheduling.service';
import { SchedulingMessage } from './schemas/scheduling-message.schema';
import { MeetingsService } from './meetings.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../services/mail/mail.service';

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439022';
const MEETING_ID = '507f1f77bcf86cd7994390aa';
const PROPOSAL_ID = '507f1f77bcf86cd7994390bb';

const userA = {
  id: USER_A,
  name: 'Carlos',
  email: 'carlos@test.com',
  locale: 'en',
  timezone: 'UTC',
};
const userB = {
  id: USER_B,
  name: 'Marta',
  email: 'marta@test.com',
  locale: 'en',
  timezone: 'UTC',
};

function futureIso(hours = 24): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeMessageDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: new Types.ObjectId().toString(),
    meetingId: new Types.ObjectId(MEETING_ID),
    senderId: new Types.ObjectId(USER_A),
    kind: 'time_proposal',
    proposedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    replyToId: undefined,
    accept: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SchedulingService', () => {
  let service: SchedulingService;
  let messageModel: Record<string, jest.Mock>;
  let meetingsService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const peer = { id: USER_B, firstName: 'Marta' };
  const meetingWithParticipants = {
    id: MEETING_ID,
    participants: [new Types.ObjectId(USER_A), new Types.ObjectId(USER_B)],
  };

  beforeEach(async () => {
    messageModel = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn(),
    };
    meetingsService = {
      findByIdForParticipant: jest.fn().mockResolvedValue(meetingWithParticipants),
      findByIdWithPeerForParticipant: jest.fn().mockResolvedValue({
        id: MEETING_ID,
        scheduledAt: futureIso(48),
        peer,
      }),
      reschedule: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findById: jest.fn((id: string) => {
        if (id === USER_A) return Promise.resolve(userA);
        if (id === USER_B) return Promise.resolve(userB);
        return Promise.resolve(null);
      }),
    };
    mailService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://app.example.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingService,
        {
          provide: getModelToken(SchedulingMessage.name),
          useValue: messageModel,
        },
        { provide: MeetingsService, useValue: meetingsService },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SchedulingService>(SchedulingService);
    jest.clearAllMocks();
    // Re-apply defaults cleared above.
    meetingsService.findByIdForParticipant.mockResolvedValue(meetingWithParticipants);
    meetingsService.findByIdWithPeerForParticipant.mockResolvedValue({
      id: MEETING_ID,
      scheduledAt: futureIso(48),
      peer,
    });
    messageModel.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
    usersService.findById.mockImplementation((id: string) => {
      if (id === USER_A) return Promise.resolve(userA);
      if (id === USER_B) return Promise.resolve(userB);
      return Promise.resolve(null);
    });
    mailService.sendMail.mockResolvedValue(undefined);
    configService.getOrThrow.mockReturnValue('https://app.example.com');
  });

  describe('getThread', () => {
    it('returns mapped messages, scheduledAt and peer', async () => {
      const doc = makeMessageDoc();
      messageModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([doc]),
      });

      const thread = await service.getThread(USER_B, MEETING_ID);

      expect(
        meetingsService.findByIdWithPeerForParticipant,
      ).toHaveBeenCalledWith(USER_B, MEETING_ID);
      expect(thread.peer).toEqual(peer);
      expect(thread.messages).toHaveLength(1);
      expect(thread.messages[0].kind).toBe('time_proposal');
      expect(thread.messages[0].proposedAt).toBe(doc.proposedAt.toISOString());
    });
  });

  describe('propose', () => {
    it('creates a time_proposal for a future time', async () => {
      const at = futureIso(24);
      await service.propose(USER_A, MEETING_ID, at);

      expect(meetingsService.findByIdForParticipant).toHaveBeenCalledWith(
        USER_A,
        MEETING_ID,
      );
      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'time_proposal' }),
      );
    });

    it('rejects a proposal in the past', async () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString();
      await expect(
        service.propose(USER_A, MEETING_ID, past),
      ).rejects.toThrow(BadRequestException);
      expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('emails the peer about the new proposal', async () => {
      const at = futureIso(24);
      await service.propose(USER_A, MEETING_ID, at);

      expect(usersService.findById).toHaveBeenCalledWith(USER_A);
      expect(usersService.findById).toHaveBeenCalledWith(USER_B);
      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userB.email,
          subject: expect.stringContaining('Carlos'),
        }),
      );
    });

    it('does not email anyone when the meeting has no other participant', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue({
        id: MEETING_ID,
        participants: [new Types.ObjectId(USER_A)],
      });
      await service.propose(USER_A, MEETING_ID, futureIso(24));

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('respond', () => {
    it('throws NotFound when the proposal does not exist', async () => {
      messageModel.findById.mockResolvedValue(null);
      await expect(
        service.respond(USER_B, MEETING_ID, PROPOSAL_ID, true),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects responding to your own proposal', async () => {
      messageModel.findById.mockResolvedValue(
        makeMessageDoc({
          _id: new Types.ObjectId(PROPOSAL_ID),
          senderId: new Types.ObjectId(USER_B),
        }),
      );
      await expect(
        service.respond(USER_B, MEETING_ID, PROPOSAL_ID, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('records a decline without rescheduling', async () => {
      messageModel.findById.mockResolvedValue(
        makeMessageDoc({
          _id: new Types.ObjectId(PROPOSAL_ID),
          senderId: new Types.ObjectId(USER_A),
        }),
      );
      await service.respond(USER_B, MEETING_ID, PROPOSAL_ID, false);

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'proposal_response', accept: false }),
      );
      expect(meetingsService.reschedule).not.toHaveBeenCalled();
    });

    it('emails the original proposer when their proposal is declined', async () => {
      messageModel.findById.mockResolvedValue(
        makeMessageDoc({
          _id: new Types.ObjectId(PROPOSAL_ID),
          senderId: new Types.ObjectId(USER_A),
        }),
      );
      await service.respond(USER_B, MEETING_ID, PROPOSAL_ID, false);

      expect(mailService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userA.email,
          subject: expect.stringContaining('Marta'),
        }),
      );
    });

    it('reschedules the meeting when the proposal is accepted', async () => {
      const proposedAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      messageModel.findById.mockResolvedValue(
        makeMessageDoc({
          _id: new Types.ObjectId(PROPOSAL_ID),
          senderId: new Types.ObjectId(USER_A),
          proposedAt,
        }),
      );
      await service.respond(USER_B, MEETING_ID, PROPOSAL_ID, true);

      expect(meetingsService.reschedule).toHaveBeenCalledWith(
        USER_B,
        MEETING_ID,
        proposedAt,
      );
    });

    it('does not send its own email when accepted (reschedule already notifies both)', async () => {
      const proposedAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      messageModel.findById.mockResolvedValue(
        makeMessageDoc({
          _id: new Types.ObjectId(PROPOSAL_ID),
          senderId: new Types.ObjectId(USER_A),
          proposedAt,
        }),
      );
      await service.respond(USER_B, MEETING_ID, PROPOSAL_ID, true);

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });
});

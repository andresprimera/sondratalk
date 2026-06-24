import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { MeetingsService } from './meetings.service';
import { Meeting } from './schemas/meeting.schema';
import { ConversationFeedback } from '../feedback/schemas/conversation-feedback.schema';
import { UsersService } from '../users/users.service';
import { MailService } from '../services/mail/mail.service';
import { AvailabilityService } from '../availability/availability.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439022';
const USER_C = '507f1f77bcf86cd799439033';

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: new Types.ObjectId().toString(),
    participants: [
      new Types.ObjectId(USER_A),
      new Types.ObjectId(USER_B),
    ],
    initiatorId: new Types.ObjectId(USER_A),
    scheduledAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    cancelled: false,
    instant: false,
    declinedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MeetingsService', () => {
  let service: MeetingsService;
  let meetingModel: Record<string, jest.Mock>;
  let feedbackModel: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let availabilityService: Record<string, jest.Mock>;
  let realtimeGateway: Record<string, jest.Mock>;

  beforeEach(async () => {
    meetingModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      aggregate: jest.fn(),
    };
    feedbackModel = {
      find: jest.fn(),
    };
    usersService = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    };
    mailService = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'msg-1',
        accepted: [],
        rejected: [],
      }),
    };
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:5174';
        if (key === 'SMTP_FROM') return 'Sondra <noreply@sondra.test>';
        throw new Error(`Unexpected key ${key}`);
      }),
    };
    availabilityService = {
      upsertByUserId: jest.fn().mockResolvedValue(undefined),
    };
    realtimeGateway = {
      emitIncomingCall: jest.fn(),
      emitCallDeclined: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: getModelToken(Meeting.name), useValue: meetingModel },
        {
          provide: getModelToken(ConversationFeedback.name),
          useValue: feedbackModel,
        },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  afterEach(() => jest.clearAllMocks());

  const flushMicrotasks = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

  describe('create', () => {
    it('creates an instant meeting with scheduledAt = now and expiresAt = now + 10m', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      const created = makeDoc({ instant: true });
      meetingModel.create.mockResolvedValue(created);

      const before = Date.now();
      const result = await service.create(USER_A, {
        peerUserId: USER_B,
        instant: true,
      });
      const after = Date.now();

      expect(meetingModel.create).toHaveBeenCalledTimes(1);
      const args = meetingModel.create.mock.calls[0][0];
      expect(args.instant).toBe(true);
      expect(args.cancelled).toBe(false);
      expect(args.participants).toHaveLength(2);
      expect(args.participants[0].toString()).toBe(USER_A);
      expect(args.participants[1].toString()).toBe(USER_B);
      expect(args.initiatorId.toString()).toBe(USER_A);

      const scheduled = (args.scheduledAt as Date).getTime();
      const expires = (args.expiresAt as Date).getTime();
      expect(scheduled).toBeGreaterThanOrEqual(before);
      expect(scheduled).toBeLessThanOrEqual(after);
      expect(expires - scheduled).toBe(10 * 60 * 1000);

      expect(result).toBe(created);
    });

    it('creates a scheduled meeting with expiresAt = scheduledAt + 1h', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const created = makeDoc({ scheduledAt: future });
      meetingModel.create.mockResolvedValue(created);

      await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: future.toISOString(),
      });

      const args = meetingModel.create.mock.calls[0][0];
      expect(args.instant).toBe(false);
      expect((args.scheduledAt as Date).getTime()).toBe(future.getTime());
      expect((args.expiresAt as Date).getTime()).toBe(
        future.getTime() + 60 * 60 * 1000,
      );
    });

    it('rejects when both instant and scheduledAt are provided', async () => {
      await expect(
        service.create(USER_A, {
          peerUserId: USER_B,
          instant: true,
          scheduledAt: new Date(Date.now() + 10000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(meetingModel.create).not.toHaveBeenCalled();
    });

    it('rejects when neither instant nor scheduledAt is provided', async () => {
      await expect(
        service.create(USER_A, { peerUserId: USER_B }),
      ).rejects.toThrow(BadRequestException);
      expect(meetingModel.create).not.toHaveBeenCalled();
    });

    it('rejects scheduledAt in the past', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      const past = new Date(Date.now() - 60000);
      await expect(
        service.create(USER_A, {
          peerUserId: USER_B,
          scheduledAt: past.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(meetingModel.create).not.toHaveBeenCalled();
    });

    it('rejects self-call', async () => {
      await expect(
        service.create(USER_A, { peerUserId: USER_A, instant: true }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('rejects invalid peer ObjectId', async () => {
      await expect(
        service.create(USER_A, {
          peerUserId: 'not-an-objectid',
          instant: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('rejects when peer not found', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(
        service.create(USER_A, { peerUserId: USER_B, instant: true }),
      ).rejects.toThrow(NotFoundException);
      expect(meetingModel.create).not.toHaveBeenCalled();
    });

    it('does not send calendar invites for instant meetings', async () => {
      usersService.findById.mockResolvedValue({
        id: USER_B,
        name: 'Beatriz',
        email: 'b@x.test',
        locale: 'en',
      });
      meetingModel.create.mockResolvedValue(makeDoc({ instant: true }));

      await service.create(USER_A, {
        peerUserId: USER_B,
        instant: true,
      });
      await flushMicrotasks();

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });

    it('marks the initiator available when starting an instant call', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      meetingModel.create.mockResolvedValue(makeDoc({ instant: true }));

      await service.create(USER_A, {
        peerUserId: USER_B,
        instant: true,
      });

      expect(availabilityService.upsertByUserId).toHaveBeenCalledWith(USER_A, {
        isAvailableNow: true,
      });
    });

    it('does not mark the initiator available for scheduled meetings', async () => {
      usersService.findById.mockResolvedValue({
        id: USER_B,
        name: 'Beatriz',
        email: 'b@x.test',
        locale: 'en',
      });
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      meetingModel.create.mockResolvedValue(
        makeDoc({ scheduledAt: future, instant: false }),
      );

      await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: future.toISOString(),
      });

      expect(availabilityService.upsertByUserId).not.toHaveBeenCalled();
    });

    it('still returns the meeting if marking the initiator available fails', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      const created = makeDoc({ instant: true });
      meetingModel.create.mockResolvedValue(created);
      availabilityService.upsertByUserId.mockRejectedValueOnce(
        new Error('db blip'),
      );

      const result = await service.create(USER_A, {
        peerUserId: USER_B,
        instant: true,
      });

      expect(result).toBe(created);
    });

    it('sends one calendar invite to each participant for scheduled meetings, localized per recipient', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const peer = {
        id: USER_B,
        name: 'Beatriz Lopez',
        email: 'beatriz@x.test',
        locale: 'es',
      };
      const initiator = {
        id: USER_A,
        name: 'Ana María',
        email: 'ana@x.test',
        locale: 'en',
      };
      // First call: peer lookup inside create. Second call: initiator lookup inside sendCalendarInvites.
      usersService.findById
        .mockResolvedValueOnce(peer)
        .mockResolvedValueOnce(initiator);
      meetingModel.create.mockResolvedValue(
        makeDoc({ scheduledAt: future, instant: false }),
      );

      await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: future.toISOString(),
      });
      await flushMicrotasks();

      expect(mailService.sendMail).toHaveBeenCalledTimes(2);
      const calls = mailService.sendMail.mock.calls.map((c) => c[0]);

      const initiatorMail = calls.find((c) => c.to === 'ana@x.test');
      const peerMail = calls.find((c) => c.to === 'beatriz@x.test');
      expect(initiatorMail).toBeDefined();
      expect(peerMail).toBeDefined();

      // Initiator is English-locale.
      expect(initiatorMail.subject).toMatch(
        /Your conversation with Beatriz is confirmed/,
      );
      // Peer is Spanish-locale.
      expect(peerMail.subject).toMatch(
        /Tu conversación con Ana está confirmada/,
      );

      // ICS attachment present on both.
      expect(initiatorMail.attachments[0].filename).toBe('sondra-meeting.ics');
      expect(peerMail.attachments[0].filename).toBe('sondra-meeting.ics');
      expect(initiatorMail.attachments[0].content).toContain('BEGIN:VCALENDAR');
      expect(peerMail.attachments[0].content).toContain('BEGIN:VCALENDAR');
    });

    it("renders the conversation time in each recipient's own timezone", async () => {
      // June -> America/New_York is EDT (UTC-4), so 14:30 UTC is 10:30 local.
      const scheduledAt = new Date('2099-06-01T14:30:00Z');
      const peer = {
        id: USER_B,
        name: 'Beatriz Lopez',
        email: 'bea@x.test',
        locale: 'en',
        timezone: 'America/New_York',
      };
      const initiator = {
        id: USER_A,
        name: 'Ana María',
        email: 'ana@x.test',
        locale: 'en',
        timezone: 'UTC',
      };
      usersService.findById
        .mockResolvedValueOnce(peer)
        .mockResolvedValueOnce(initiator);
      meetingModel.create.mockResolvedValue(
        makeDoc({ scheduledAt, instant: false }),
      );

      await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: scheduledAt.toISOString(),
      });
      await flushMicrotasks();

      const calls = mailService.sendMail.mock.calls.map((c) => c[0]);
      const peerMail = calls.find((c) => c.to === 'bea@x.test');
      const initiatorMail = calls.find((c) => c.to === 'ana@x.test');

      // Peer is in New York: time shifts to 10:30 and shows their offset.
      expect(peerMail.text).toContain('10:30 – 11:30');
      expect(peerMail.text).not.toContain('14:30');
      expect(peerMail.text).toMatch(/GMT-4|EDT/);
      // Initiator is in UTC: time is unchanged.
      expect(initiatorMail.text).toContain('14:30 – 15:30');
      expect(initiatorMail.text).toContain('UTC');
    });

    it('does not fail meeting creation when calendar invites fail to send', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      usersService.findById
        .mockResolvedValueOnce({
          id: USER_B,
          name: 'Beatriz',
          email: 'b@x.test',
          locale: 'en',
        })
        .mockResolvedValueOnce({
          id: USER_A,
          name: 'Ana',
          email: 'a@x.test',
          locale: 'en',
        });
      const created = makeDoc({ scheduledAt: future, instant: false });
      meetingModel.create.mockResolvedValue(created);
      mailService.sendMail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: future.toISOString(),
      });
      await flushMicrotasks();

      expect(result).toBe(created);
    });

    it('rings the peer over the socket when starting an instant call', async () => {
      // First findById: peer lookup. Second: initiator lookup for the caller name.
      usersService.findById
        .mockResolvedValueOnce({ id: USER_B, name: 'Beatriz' })
        .mockResolvedValueOnce({ id: USER_A, name: 'Ana María' });
      const created = makeDoc({ instant: true });
      meetingModel.create.mockResolvedValue(created);

      await service.create(USER_A, { peerUserId: USER_B, instant: true });

      expect(realtimeGateway.emitIncomingCall).toHaveBeenCalledTimes(1);
      const [calleeId, payload] =
        realtimeGateway.emitIncomingCall.mock.calls[0];
      expect(calleeId).toBe(USER_B);
      expect(payload.meetingId).toBe(created.id);
      expect(payload.caller).toEqual({ id: USER_A, firstName: 'Ana' });
      expect(typeof payload.ringExpiresAt).toBe('string');
    });

    it('does not ring the peer for scheduled meetings', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      usersService.findById.mockResolvedValue({
        id: USER_B,
        name: 'Beatriz',
        email: 'b@x.test',
        locale: 'en',
      });
      meetingModel.create.mockResolvedValue(
        makeDoc({ scheduledAt: future, instant: false }),
      );

      await service.create(USER_A, {
        peerUserId: USER_B,
        scheduledAt: future.toISOString(),
      });
      await flushMicrotasks();

      expect(realtimeGateway.emitIncomingCall).not.toHaveBeenCalled();
    });

    it('still returns the meeting if ringing the peer fails', async () => {
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      const created = makeDoc({ instant: true });
      meetingModel.create.mockResolvedValue(created);
      realtimeGateway.emitIncomingCall.mockImplementationOnce(() => {
        throw new Error('socket blip');
      });

      const result = await service.create(USER_A, {
        peerUserId: USER_B,
        instant: true,
      });

      expect(result).toBe(created);
    });
  });

  describe('findUpcomingForUser', () => {
    beforeEach(() => {
      jest.spyOn(service, 'hasMutualDoorOpen').mockResolvedValue(false);
    });

    it('returns an empty array when no meetings match', async () => {
      meetingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findUpcomingForUser(USER_A);

      expect(result).toEqual([]);
      expect(usersService.findByIds).not.toHaveBeenCalled();
    });

    it('returns meetings with peer ids but anonymous names by default', async () => {
      const future1 = new Date(Date.now() + 60 * 60 * 1000);
      const future2 = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const doc1 = makeDoc({ scheduledAt: future1 });
      const doc2 = makeDoc({
        scheduledAt: future2,
        participants: [
          new Types.ObjectId(USER_A),
          new Types.ObjectId(USER_C),
        ],
      });

      meetingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([doc1, doc2]),
        }),
      });
      usersService.findByIds.mockResolvedValue([
        { id: USER_B, name: 'Beatriz Lopez' },
        { id: USER_C, name: 'Carla' },
      ]);

      const result = await service.findUpcomingForUser(USER_A);

      expect(result).toHaveLength(2);
      expect(result[0].peer.id).toBe(USER_B);
      expect(result[0].peer.firstName).toBe('');
      expect(result[1].peer.id).toBe(USER_C);
      expect(result[1].peer.firstName).toBe('');

      const findArgs = meetingModel.find.mock.calls[0][0];
      expect(findArgs.cancelled).toBe(false);
      expect(findArgs.participants.toString()).toBe(USER_A);
      expect(findArgs.expiresAt).toEqual({ $gt: expect.any(Date) });
      expect(findArgs.scheduledAt).toEqual({ $gt: expect.any(Date) });
    });

    it('reveals the peer first name when that peer has a mutual door-open', async () => {
      const doc = makeDoc();
      meetingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([doc]),
        }),
      });
      usersService.findByIds.mockResolvedValue([
        { id: USER_B, name: 'Beatriz Lopez' },
      ]);
      jest.spyOn(service, 'hasMutualDoorOpen').mockResolvedValue(true);

      const result = await service.findUpcomingForUser(USER_A);

      expect(result[0].peer.firstName).toBe('Beatriz');
      expect(service.hasMutualDoorOpen).toHaveBeenCalledWith(USER_A, USER_B);
    });

    it('falls back to empty firstName when the peer user is gone', async () => {
      const doc = makeDoc();
      meetingModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([doc]),
        }),
      });
      usersService.findByIds.mockResolvedValue([]);

      const result = await service.findUpcomingForUser(USER_A);

      expect(result).toHaveLength(1);
      expect(result[0].peer.firstName).toBe('');
    });
  });

  describe('findByIdForParticipant', () => {
    const validId = '507f1f77bcf86cd799439aaa';

    it('returns the doc when the user is a participant and the meeting is active', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);

      const result = await service.findByIdForParticipant(USER_A, validId);

      expect(result).toBe(doc);
    });

    it('throws NotFoundException for a non-objectid id', async () => {
      await expect(
        service.findByIdForParticipant(USER_A, 'not-valid'),
      ).rejects.toThrow(NotFoundException);
      expect(meetingModel.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the meeting is missing', async () => {
      meetingModel.findById.mockResolvedValue(null);
      await expect(
        service.findByIdForParticipant(USER_A, validId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (not Forbidden) when the user is not a participant', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);
      await expect(
        service.findByIdForParticipant(USER_C, validId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the meeting is cancelled', async () => {
      const doc = makeDoc({ cancelled: true });
      meetingModel.findById.mockResolvedValue(doc);
      await expect(
        service.findByIdForParticipant(USER_A, validId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdWithPeerForParticipant', () => {
    const validId = '507f1f77bcf86cd799439aaa';

    beforeEach(() => {
      jest.spyOn(service, 'hasMutualDoorOpen').mockResolvedValue(false);
    });

    it('returns an anonymous peer name by default', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });

      const result = await service.findByIdWithPeerForParticipant(
        USER_A,
        validId,
      );

      expect(result.peer.id).toBe(USER_B);
      expect(result.peer.firstName).toBe('');
    });

    it('reveals the real first name when the pair has a mutual door-open', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);
      usersService.findById.mockResolvedValue({ id: USER_B, name: 'Beatriz' });
      jest.spyOn(service, 'hasMutualDoorOpen').mockResolvedValue(true);

      const result = await service.findByIdWithPeerForParticipant(
        USER_A,
        validId,
      );

      expect(result.peer.firstName).toBe('Beatriz');
      expect(service.hasMutualDoorOpen).toHaveBeenCalledWith(USER_A, USER_B);
    });

    it('returns an empty firstName when the peer user is gone', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);
      usersService.findById.mockResolvedValue(null);

      const result = await service.findByIdWithPeerForParticipant(
        USER_A,
        validId,
      );

      expect(result.peer.firstName).toBe('');
      expect(service.hasMutualDoorOpen).not.toHaveBeenCalled();
    });
  });

  describe('hasMutualDoorOpen', () => {
    it('returns false when the pair has no shared meetings', async () => {
      meetingModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const result = await service.hasMutualDoorOpen(USER_A, USER_B);

      expect(result).toBe(false);
      expect(feedbackModel.find).not.toHaveBeenCalled();
    });

    it('returns false when only one side of a shared meeting left the door open', async () => {
      const meetingOid = new Types.ObjectId();
      meetingModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: meetingOid }]),
      });
      feedbackModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { meetingId: meetingOid, userId: new Types.ObjectId(USER_A) },
        ]),
      });

      const result = await service.hasMutualDoorOpen(USER_A, USER_B);

      expect(result).toBe(false);
    });

    it('returns true when both sides left the door open on a shared meeting', async () => {
      const meetingOid = new Types.ObjectId();
      meetingModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: meetingOid }]),
      });
      feedbackModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { meetingId: meetingOid, userId: new Types.ObjectId(USER_A) },
          { meetingId: meetingOid, userId: new Types.ObjectId(USER_B) },
        ]),
      });

      const result = await service.hasMutualDoorOpen(USER_A, USER_B);

      expect(result).toBe(true);
    });

    it('returns true when the mutual door-open happened on an older meeting, not just the latest', async () => {
      const olderMeetingOid = new Types.ObjectId();
      const newerMeetingOid = new Types.ObjectId();
      meetingModel.find.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue([
            { _id: olderMeetingOid },
            { _id: newerMeetingOid },
          ]),
      });
      feedbackModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { meetingId: olderMeetingOid, userId: new Types.ObjectId(USER_A) },
          { meetingId: olderMeetingOid, userId: new Types.ObjectId(USER_B) },
          { meetingId: newerMeetingOid, userId: new Types.ObjectId(USER_A) },
        ]),
      });

      const result = await service.hasMutualDoorOpen(USER_A, USER_B);

      expect(result).toBe(true);
    });
  });

  describe('cancel', () => {
    const validId = '507f1f77bcf86cd799439aaa';

    it('flips cancelled to true and saves', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);

      await service.cancel(USER_A, validId);

      expect(doc.cancelled).toBe(true);
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it('refuses non-participants via the shared auth check', async () => {
      const doc = makeDoc();
      meetingModel.findById.mockResolvedValue(doc);
      await expect(service.cancel(USER_C, validId)).rejects.toThrow(
        NotFoundException,
      );
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('markDeclined', () => {
    const validId = '507f1f77bcf86cd799439aaa';

    it('sets declinedAt and saves when the non-initiator declines an instant call', async () => {
      const doc = makeDoc({ instant: true });
      meetingModel.findById.mockResolvedValue(doc);

      const result = await service.markDeclined(USER_B, validId);

      expect(doc.declinedAt).toBeInstanceOf(Date);
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(doc);
    });

    it('rejects declining a non-instant meeting', async () => {
      const doc = makeDoc({ instant: false });
      meetingModel.findById.mockResolvedValue(doc);

      await expect(service.markDeclined(USER_B, validId)).rejects.toThrow(
        BadRequestException,
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('rejects the initiator declining their own call', async () => {
      const doc = makeDoc({ instant: true });
      meetingModel.findById.mockResolvedValue(doc);

      await expect(service.markDeclined(USER_A, validId)).rejects.toThrow(
        BadRequestException,
      );
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('is idempotent — re-declining does not save again', async () => {
      const doc = makeDoc({ instant: true, declinedAt: new Date() });
      meetingModel.findById.mockResolvedValue(doc);

      const result = await service.markDeclined(USER_B, validId);

      expect(doc.save).not.toHaveBeenCalled();
      expect(result).toBe(doc);
    });

    it('refuses non-participants via the shared auth check', async () => {
      const doc = makeDoc({ instant: true });
      meetingModel.findById.mockResolvedValue(doc);

      await expect(service.markDeclined(USER_C, validId)).rejects.toThrow(
        NotFoundException,
      );
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('countConversationsForUsers', () => {
    it('returns an empty map without querying when given no users', async () => {
      const result = await service.countConversationsForUsers([]);

      expect(result.size).toBe(0);
      expect(meetingModel.aggregate).not.toHaveBeenCalled();
    });

    it('maps each user id to its aggregated conversation count', async () => {
      const a = new Types.ObjectId(USER_A);
      const b = new Types.ObjectId(USER_B);
      meetingModel.aggregate.mockResolvedValue([
        { _id: a, count: 3 },
        { _id: b, count: 1 },
      ]);

      const result = await service.countConversationsForUsers([a, b]);

      expect(result.get(USER_A)).toBe(3);
      expect(result.get(USER_B)).toBe(1);
      // Users absent from the aggregation are simply not in the map.
      expect(result.has(USER_C)).toBe(false);
    });
  });
});

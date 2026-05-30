import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { MeetingsService } from './meetings.service';
import { Meeting } from './schemas/meeting.schema';
import { UsersService } from '../users/users.service';
import { MailService } from '../services/mail/mail.service';
import { AvailabilityService } from '../availability/availability.service';

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
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MeetingsService', () => {
  let service: MeetingsService;
  let meetingModel: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let availabilityService: Record<string, jest.Mock>;

  beforeEach(async () => {
    meetingModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: getModelToken(Meeting.name), useValue: meetingModel },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
        { provide: AvailabilityService, useValue: availabilityService },
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
        /Sondra: Conversation with Beatriz/,
      );
      // Peer is Spanish-locale.
      expect(peerMail.subject).toMatch(/Sondra: Conversación con Ana/);

      // ICS attachment present on both.
      expect(initiatorMail.attachments[0].filename).toBe('sondra-meeting.ics');
      expect(peerMail.attachments[0].filename).toBe('sondra-meeting.ics');
      expect(initiatorMail.attachments[0].content).toContain('BEGIN:VCALENDAR');
      expect(peerMail.attachments[0].content).toContain('BEGIN:VCALENDAR');
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
  });

  describe('findUpcomingForUser', () => {
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

    it('returns meetings with peer first names, sorted by the model chain', async () => {
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
      expect(result[0].peer.firstName).toBe('Beatriz');
      expect(result[1].peer.id).toBe(USER_C);
      expect(result[1].peer.firstName).toBe('Carla');

      const findArgs = meetingModel.find.mock.calls[0][0];
      expect(findArgs.cancelled).toBe(false);
      expect(findArgs.participants.toString()).toBe(USER_A);
      expect(findArgs.expiresAt).toEqual({ $gt: expect.any(Date) });
      expect(findArgs.scheduledAt).toEqual({ $gt: expect.any(Date) });
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
});

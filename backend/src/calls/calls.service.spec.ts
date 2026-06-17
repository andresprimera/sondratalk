import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { LivekitService } from '../services/livekit/livekit.service';
import { MeetingsService } from '../meetings/meetings.service';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const CALLER_ID = '507f1f77bcf86cd799439011';
const PEER_ID = '507f1f77bcf86cd799439022';
const MEETING_ID = '507f1f77bcf86cd799439aaa';

function makeMeetingDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: MEETING_ID,
    participants: [CALLER_ID, PEER_ID],
    scheduledAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    cancelled: false,
    instant: true,
    ...overrides,
  };
}

describe('CallsService', () => {
  let service: CallsService;
  let livekitService: Record<string, jest.Mock>;
  let meetingsService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let realtimeGateway: Record<string, jest.Mock>;

  beforeEach(async () => {
    livekitService = {
      generateAccessToken: jest.fn().mockResolvedValue({
        token: 'signed.jwt.value',
        url: 'wss://example.livekit.cloud',
        roomName: 'whatever',
      }),
    };
    meetingsService = {
      findByIdForParticipant: jest.fn(),
      markDeclined: jest.fn(),
    };
    usersService = {
      findById: jest.fn(),
    };
    realtimeGateway = {
      emitIncomingCall: jest.fn(),
      emitCallDeclined: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: LivekitService, useValue: livekitService },
        { provide: MeetingsService, useValue: meetingsService },
        { provide: UsersService, useValue: usersService },
        { provide: RealtimeGateway, useValue: realtimeGateway },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateToken', () => {
    it('mints a token with identity, caller name, and room derived from the meeting id', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(makeMeetingDoc());
      usersService.findById.mockResolvedValue({
        id: CALLER_ID,
        name: 'Ana María',
      });

      const result = await service.generateToken(CALLER_ID, MEETING_ID);

      expect(meetingsService.findByIdForParticipant).toHaveBeenCalledWith(
        CALLER_ID,
        MEETING_ID,
      );
      expect(livekitService.generateAccessToken).toHaveBeenCalledTimes(1);
      const args = livekitService.generateAccessToken.mock.calls[0][0];
      expect(args.identity).toBe(CALLER_ID);
      expect(args.name).toBe('Ana María');
      expect(args.roomName).toBe(`mtg:${MEETING_ID}`);

      expect(result).toEqual({
        token: 'signed.jwt.value',
        url: 'wss://example.livekit.cloud',
        roomName: `mtg:${MEETING_ID}`,
        identity: CALLER_ID,
      });
    });

    it('rejects when the scheduled time is more than 5 minutes in the future', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(
        makeMeetingDoc({ scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000) }),
      );

      await expect(
        service.generateToken(CALLER_ID, MEETING_ID),
      ).rejects.toThrow(BadRequestException);

      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('rejects when the scheduled time is more than 60 minutes in the past', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(
        makeMeetingDoc({ scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
      );

      await expect(
        service.generateToken(CALLER_ID, MEETING_ID),
      ).rejects.toThrow(BadRequestException);

      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from findByIdForParticipant', async () => {
      meetingsService.findByIdForParticipant.mockRejectedValue(
        new NotFoundException('Meeting not found'),
      );

      await expect(
        service.generateToken(CALLER_ID, MEETING_ID),
      ).rejects.toThrow(NotFoundException);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the caller user is missing', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(makeMeetingDoc());
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.generateToken(CALLER_ID, MEETING_ID),
      ).rejects.toThrow(NotFoundException);

      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('accepts meetings whose scheduledAt is exactly now', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(
        makeMeetingDoc({ scheduledAt: new Date() }),
      );
      usersService.findById.mockResolvedValue({ id: CALLER_ID, name: 'Ana' });

      const result = await service.generateToken(CALLER_ID, MEETING_ID);
      expect(result.token).toBe('signed.jwt.value');
    });

    it('accepts meetings up to 5 minutes before scheduledAt', async () => {
      meetingsService.findByIdForParticipant.mockResolvedValue(
        makeMeetingDoc({
          scheduledAt: new Date(Date.now() + 4 * 60 * 1000),
        }),
      );
      usersService.findById.mockResolvedValue({ id: CALLER_ID, name: 'Ana' });

      const result = await service.generateToken(CALLER_ID, MEETING_ID);
      expect(result.token).toBe('signed.jwt.value');
    });
  });

  describe('declineCall', () => {
    it('marks the meeting declined and notifies the caller over the socket', async () => {
      meetingsService.markDeclined.mockResolvedValue({
        id: MEETING_ID,
        initiatorId: { toString: () => CALLER_ID },
      });

      await service.declineCall(PEER_ID, MEETING_ID);

      expect(meetingsService.markDeclined).toHaveBeenCalledWith(
        PEER_ID,
        MEETING_ID,
      );
      expect(realtimeGateway.emitCallDeclined).toHaveBeenCalledWith(CALLER_ID, {
        meetingId: MEETING_ID,
      });
    });

    it('propagates errors from markDeclined without emitting', async () => {
      meetingsService.markDeclined.mockRejectedValue(
        new BadRequestException('Cannot decline your own call'),
      );

      await expect(
        service.declineCall(CALLER_ID, MEETING_ID),
      ).rejects.toThrow(BadRequestException);

      expect(realtimeGateway.emitCallDeclined).not.toHaveBeenCalled();
    });
  });
});

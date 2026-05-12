import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { LivekitService } from '../services/livekit/livekit.service';
import { UsersService } from '../users/users.service';

const CALLER_ID = '507f1f77bcf86cd799439011';
const PEER_ID = '507f1f77bcf86cd799439022';

describe('CallsService', () => {
  let service: CallsService;
  let livekitService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;

  beforeEach(async () => {
    livekitService = {
      generateAccessToken: jest.fn().mockResolvedValue({
        token: 'signed.jwt.value',
        url: 'wss://example.livekit.cloud',
        roomName: 'whatever',
      }),
    };
    usersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: LivekitService, useValue: livekitService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<CallsService>(CallsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateToken', () => {
    it('mints a token via LivekitService with caller identity, name, and derived room name', async () => {
      usersService.findById
        .mockResolvedValueOnce({ id: CALLER_ID, name: 'Ana María' })
        .mockResolvedValueOnce({ id: PEER_ID, name: 'Beatriz' });

      const result = await service.generateToken(CALLER_ID, PEER_ID);

      expect(livekitService.generateAccessToken).toHaveBeenCalledTimes(1);
      const args = livekitService.generateAccessToken.mock.calls[0][0];
      expect(args.identity).toBe(CALLER_ID);
      expect(args.name).toBe('Ana María');
      expect(args.roomName).toBe(`${CALLER_ID}--${PEER_ID}`);

      expect(result).toEqual({
        token: 'signed.jwt.value',
        url: 'wss://example.livekit.cloud',
        roomName: `${CALLER_ID}--${PEER_ID}`,
        identity: CALLER_ID,
      });
    });

    it('derives the same room name regardless of which side is caller', async () => {
      usersService.findById.mockImplementation(async (id: string) => ({
        id,
        name: id === CALLER_ID ? 'Ana' : 'Bea',
      }));

      await service.generateToken(CALLER_ID, PEER_ID);
      const roomA = livekitService.generateAccessToken.mock.calls[0][0].roomName;

      await service.generateToken(PEER_ID, CALLER_ID);
      const roomB = livekitService.generateAccessToken.mock.calls[1][0].roomName;

      expect(roomA).toBe(roomB);
      expect(roomA).toBe(`${CALLER_ID}--${PEER_ID}`);
    });

    it('rejects calling yourself with BadRequestException', async () => {
      await expect(
        service.generateToken(CALLER_ID, CALLER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a peerUserId that is not a valid ObjectId', async () => {
      await expect(
        service.generateToken(CALLER_ID, 'not-an-object-id'),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the caller does not exist', async () => {
      usersService.findById.mockResolvedValueOnce(null);

      await expect(
        service.generateToken(CALLER_ID, PEER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the peer does not exist', async () => {
      usersService.findById
        .mockResolvedValueOnce({ id: CALLER_ID, name: 'Ana' })
        .mockResolvedValueOnce(null);

      await expect(
        service.generateToken(CALLER_ID, PEER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(livekitService.generateAccessToken).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { CALL_SOCKET_EVENTS } from '@base-dashboard/shared';
import { RealtimeGateway } from './realtime.gateway';

const USER_ID = '507f1f77bcf86cd799439011';
const PEER_ID = '507f1f77bcf86cd799439022';

function makeSocket(auth: unknown): Socket & {
  join: jest.Mock;
  disconnect: jest.Mock;
  data: Record<string, unknown>;
} {
  return {
    handshake: { auth },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  } as unknown as Socket & {
    join: jest.Mock;
    disconnect: jest.Mock;
    data: Record<string, unknown>;
  };
}

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('access-secret') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleConnection', () => {
    it('joins the user-room when the handshake token is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: USER_ID });
      const client = makeSocket({ token: 'good.jwt.token' });

      await gateway.handleConnection(client);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('good.jwt.token', {
        secret: 'access-secret',
      });
      expect(client.join).toHaveBeenCalledWith(USER_ID);
      expect(client.data.userId).toBe(USER_ID);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects when no token is present', async () => {
      const client = makeSocket({});

      await gateway.handleConnection(client);

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when the token fails verification', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));
      const client = makeSocket({ token: 'bad.jwt.token' });

      await gateway.handleConnection(client);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('emit helpers', () => {
    it('emits incoming-call to the callee user-room', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;

      const payload = {
        meetingId: 'm1',
        caller: { id: USER_ID, firstName: 'Ana' },
        ringExpiresAt: new Date().toISOString(),
      };
      gateway.emitIncomingCall(PEER_ID, payload);

      expect(to).toHaveBeenCalledWith(PEER_ID);
      expect(emit).toHaveBeenCalledWith(
        CALL_SOCKET_EVENTS.incomingCall,
        payload,
      );
    });

    it('emits call-declined to the caller user-room', () => {
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;

      gateway.emitCallDeclined(USER_ID, { meetingId: 'm1' });

      expect(to).toHaveBeenCalledWith(USER_ID);
      expect(emit).toHaveBeenCalledWith(CALL_SOCKET_EVENTS.callDeclined, {
        meetingId: 'm1',
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LivekitService } from './livekit.service';

interface DecodedJwt {
  iss: string;
  sub: string;
  nbf: number;
  exp: number;
  name?: string;
  video?: {
    room?: string;
    roomJoin?: boolean;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
  };
}

function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Not a JWT');
  const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(payload) as DecodedJwt;
}

const API_KEY = 'devkey';
const API_SECRET = 'devsecret-at-least-32-chars-long-xxxx';
const SERVER_URL = 'wss://example.livekit.cloud';

function buildConfigMock(overrides: Record<string, string | undefined> = {}) {
  return {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string | undefined> = {
        LIVEKIT_API_KEY: API_KEY,
        LIVEKIT_API_SECRET: API_SECRET,
        LIVEKIT_URL: SERVER_URL,
        ...overrides,
      };
      const value = map[key];
      if (value === undefined) {
        throw new Error(`Missing env: ${key}`);
      }
      return value;
    }),
  };
}

async function buildService(
  configMock: ReturnType<typeof buildConfigMock>,
): Promise<LivekitService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LivekitService,
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();
  return module.get<LivekitService>(LivekitService);
}

describe('LivekitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('returns a signed JWT carrying the requested identity, name, room, and full publish/subscribe grants', async () => {
      const service = await buildService(buildConfigMock());

      const result = await service.generateAccessToken({
        identity: 'user-123',
        name: 'Ana',
        roomName: 'room-abc',
      });

      expect(result.url).toBe(SERVER_URL);
      expect(result.roomName).toBe('room-abc');
      expect(result.token).toEqual(expect.any(String));
      expect(result.token.length).toBeGreaterThan(0);

      const decoded = decodeJwt(result.token);
      expect(decoded.iss).toBe(API_KEY);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.name).toBe('Ana');
      expect(decoded.video?.room).toBe('room-abc');
      expect(decoded.video?.roomJoin).toBe(true);
      expect(decoded.video?.canPublish).toBe(true);
      expect(decoded.video?.canSubscribe).toBe(true);
      expect(decoded.video?.canPublishData).toBe(true);
    });

    it('defaults to a 15-minute TTL when ttlSeconds is omitted', async () => {
      const service = await buildService(buildConfigMock());

      const result = await service.generateAccessToken({
        identity: 'user-123',
        name: 'Ana',
        roomName: 'room-abc',
      });

      const decoded = decodeJwt(result.token);
      expect(decoded.exp - decoded.nbf).toBe(15 * 60);
    });

    it('honours a custom ttlSeconds', async () => {
      const service = await buildService(buildConfigMock());

      const result = await service.generateAccessToken({
        identity: 'user-123',
        name: 'Ana',
        roomName: 'room-abc',
        ttlSeconds: 3600,
      });

      const decoded = decodeJwt(result.token);
      expect(decoded.exp - decoded.nbf).toBe(3600);
    });

    it('throws at construction time when LIVEKIT_API_KEY is missing', async () => {
      const configMock = buildConfigMock({ LIVEKIT_API_KEY: undefined });

      await expect(buildService(configMock)).rejects.toThrow(
        /Missing env: LIVEKIT_API_KEY/,
      );
    });

    it('throws at construction time when LIVEKIT_API_SECRET is missing', async () => {
      const configMock = buildConfigMock({ LIVEKIT_API_SECRET: undefined });

      await expect(buildService(configMock)).rejects.toThrow(
        /Missing env: LIVEKIT_API_SECRET/,
      );
    });

    it('throws at construction time when LIVEKIT_URL is missing', async () => {
      const configMock = buildConfigMock({ LIVEKIT_URL: undefined });

      await expect(buildService(configMock)).rejects.toThrow(
        /Missing env: LIVEKIT_URL/,
      );
    });
  });
});

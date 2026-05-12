import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import type {
  AccessTokenResult,
  GenerateAccessTokenOptions,
} from './livekit.types';

const DEFAULT_TTL_SECONDS = 15 * 60;

@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serverUrl: string;
  private readonly logger = new Logger(LivekitService.name);

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('LIVEKIT_API_KEY');
    this.apiSecret = this.configService.getOrThrow<string>('LIVEKIT_API_SECRET');
    this.serverUrl = this.configService.getOrThrow<string>('LIVEKIT_URL');
  }

  async generateAccessToken(
    options: GenerateAccessTokenOptions,
  ): Promise<AccessTokenResult> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: options.identity,
      name: options.name,
      ttl: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
    });

    at.addGrant({
      room: options.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    this.logger.log(
      `Issued LiveKit token for identity=${options.identity} room=${options.roomName}`,
    );

    return { token, url: this.serverUrl, roomName: options.roomName };
  }
}

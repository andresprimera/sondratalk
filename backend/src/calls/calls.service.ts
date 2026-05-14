import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LivekitService } from '../services/livekit/livekit.service';
import { MeetingsService } from '../meetings/meetings.service';
import { UsersService } from '../users/users.service';
import type { CallTokenResponse } from './dto';

const JOIN_WINDOW_BEFORE_MS = 5 * 60 * 1000;
const JOIN_WINDOW_AFTER_MS = 60 * 60 * 1000;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private livekitService: LivekitService,
    private meetingsService: MeetingsService,
    private usersService: UsersService,
  ) {}

  async generateToken(
    callerId: string,
    meetingId: string,
  ): Promise<CallTokenResponse> {
    const meeting = await this.meetingsService.findByIdForParticipant(
      callerId,
      meetingId,
    );

    const now = Date.now();
    const scheduled = meeting.scheduledAt.getTime();
    if (
      now < scheduled - JOIN_WINDOW_BEFORE_MS ||
      now > scheduled + JOIN_WINDOW_AFTER_MS
    ) {
      throw new BadRequestException('Meeting is not joinable right now');
    }

    const caller = await this.usersService.findById(callerId);
    if (!caller) throw new NotFoundException('User not found');

    const roomName = `mtg:${meeting.id}`;

    const { token, url } = await this.livekitService.generateAccessToken({
      identity: callerId,
      name: caller.name,
      roomName,
    });

    this.logger.log(
      `Generated call token caller=${callerId} meeting=${meeting.id} room=${roomName}`,
    );

    return { token, url, roomName, identity: callerId };
  }
}

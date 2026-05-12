import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { LivekitService } from '../services/livekit/livekit.service';
import { UsersService } from '../users/users.service';
import type { CallTokenResponse } from './dto';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private livekitService: LivekitService,
    private usersService: UsersService,
  ) {}

  async generateToken(
    callerId: string,
    peerUserId: string,
  ): Promise<CallTokenResponse> {
    if (callerId === peerUserId) {
      throw new BadRequestException('Cannot start a call with yourself');
    }
    if (!isValidObjectId(peerUserId)) {
      throw new BadRequestException('Invalid peerUserId');
    }

    const caller = await this.usersService.findById(callerId);
    if (!caller) throw new NotFoundException('User not found');

    const peer = await this.usersService.findById(peerUserId);
    if (!peer) throw new NotFoundException('Peer not found');

    const roomName = this.deriveRoomName(callerId, peerUserId);

    const { token, url } = await this.livekitService.generateAccessToken({
      identity: callerId,
      name: caller.name,
      roomName,
    });

    this.logger.log(
      `Generated call token caller=${callerId} peer=${peerUserId} room=${roomName}`,
    );

    return { token, url, roomName, identity: callerId };
  }

  private deriveRoomName(a: string, b: string): string {
    return [a, b].slice().sort().join('--');
  }
}

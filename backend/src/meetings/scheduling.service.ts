import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  SchedulingMessage,
  SchedulingMessageDocument,
} from './schemas/scheduling-message.schema';
import { MeetingsService } from './meetings.service';
import { toSchedulingMessage } from './scheduling.mapper';
import type { SchedulingThreadResponse } from './dto/scheduling';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectModel(SchedulingMessage.name)
    private messageModel: Model<SchedulingMessage>,
    private meetingsService: MeetingsService,
  ) {}

  async getThread(
    userId: string,
    meetingId: string,
  ): Promise<SchedulingThreadResponse> {
    // Validates participation and resolves the peer in one shot.
    const meeting = await this.meetingsService.findByIdWithPeerForParticipant(
      userId,
      meetingId,
    );
    const docs = await this.messageModel
      .find({ meetingId: new Types.ObjectId(meetingId) })
      .sort({ createdAt: 1 });
    return {
      messages: docs.map(toSchedulingMessage),
      scheduledAt: meeting.scheduledAt,
      peer: meeting.peer,
    };
  }

  async propose(
    userId: string,
    meetingId: string,
    proposedAt: string,
  ): Promise<SchedulingThreadResponse> {
    // Throws if the user isn't a participant of a live meeting.
    await this.meetingsService.findByIdForParticipant(userId, meetingId);

    const when = new Date(proposedAt);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('Invalid proposedAt');
    }
    if (when.getTime() <= Date.now()) {
      throw new BadRequestException('proposedAt must be in the future');
    }

    await this.messageModel.create({
      meetingId: new Types.ObjectId(meetingId),
      senderId: new Types.ObjectId(userId),
      kind: 'time_proposal',
      proposedAt: when,
    });
    this.logger.log(
      `Proposed time ${when.toISOString()} for meeting ${meetingId} by user=${userId}`,
    );

    return this.getThread(userId, meetingId);
  }

  async respond(
    userId: string,
    meetingId: string,
    replyToId: string,
    accept: boolean,
  ): Promise<SchedulingThreadResponse> {
    await this.meetingsService.findByIdForParticipant(userId, meetingId);

    if (!isValidObjectId(replyToId)) {
      throw new NotFoundException('Proposal not found');
    }
    const proposal: SchedulingMessageDocument | null =
      await this.messageModel.findById(replyToId);
    if (
      !proposal ||
      proposal.meetingId.toString() !== meetingId ||
      proposal.kind !== 'time_proposal'
    ) {
      throw new NotFoundException('Proposal not found');
    }
    if (proposal.senderId.toString() === userId) {
      throw new BadRequestException('Cannot respond to your own proposal');
    }

    await this.messageModel.create({
      meetingId: new Types.ObjectId(meetingId),
      senderId: new Types.ObjectId(userId),
      kind: 'proposal_response',
      replyToId: proposal._id,
      accept,
    });
    this.logger.log(
      `Responded ${accept ? 'yes' : 'no'} to proposal ${replyToId} on meeting ${meetingId} by user=${userId}`,
    );

    // Agreeing on a time moves the meeting to that slot.
    if (accept && proposal.proposedAt) {
      await this.meetingsService.reschedule(
        userId,
        meetingId,
        proposal.proposedAt,
      );
    }

    return this.getThread(userId, meetingId);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import type { LocaleKey } from '@base-dashboard/shared';
import {
  SchedulingMessage,
  SchedulingMessageDocument,
} from './schemas/scheduling-message.schema';
import { MeetingsService, MEETING_DURATION_MINUTES } from './meetings.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../services/mail/mail.service';
import { toSchedulingMessage } from './scheduling.mapper';
import { extractFirstName } from './meetings.mapper';
import {
  formatDayLabel,
  formatTimeRange,
  formatTimeZoneLabel,
  type MeetingEmailData,
} from './meeting-email';
import {
  PROPOSED_TIME_EMAIL_COPY,
  PROPOSAL_DECLINED_EMAIL_COPY,
  type SchedulingEmailCopy,
} from './scheduling-email';
import type { UserDocument } from '../users/schemas/user.schema';
import type { SchedulingThreadResponse } from './dto/scheduling';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectModel(SchedulingMessage.name)
    private messageModel: Model<SchedulingMessage>,
    private meetingsService: MeetingsService,
    private usersService: UsersService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  // Fire-and-forget notification email for a scheduling-thread event (a new
  // proposal, or a decline) — the meeting's own confirmation email already
  // covers the "accepted" case via MeetingsService.reschedule().
  private sendSchedulingNotification(
    copy: Record<LocaleKey, SchedulingEmailCopy>,
    recipient: UserDocument,
    otherFirst: string,
    proposedAt: Date,
    meetingId: string,
  ): void {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const threadUrl = `${frontendUrl}/dashboard/conversations/${meetingId}/schedule`;
    const locale: LocaleKey = recipient.locale === 'es' ? 'es' : 'en';
    const localeCopy = copy[locale];
    const tz = recipient.timezone || 'UTC';
    const emailData: MeetingEmailData = {
      otherFirst,
      dayLabel: formatDayLabel(proposedAt, locale, tz),
      timeRange: formatTimeRange(proposedAt, MEETING_DURATION_MINUTES, locale, tz),
      tzLabel: formatTimeZoneLabel(proposedAt, locale, tz),
      joinUrl: threadUrl,
    };

    this.mailService
      .sendMail({
        to: recipient.email,
        subject: localeCopy.subject(otherFirst),
        text: localeCopy.bodyText(emailData),
        html: localeCopy.bodyHtml(emailData),
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to send scheduling notification for meeting ${meetingId}`,
          err,
        ),
      );
  }

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
    const meeting = await this.meetingsService.findByIdForParticipant(
      userId,
      meetingId,
    );

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

    const peerObjectId = meeting.participants.find(
      (p) => p.toString() !== userId,
    );
    if (peerObjectId) {
      const [sender, peer] = await Promise.all([
        this.usersService.findById(userId),
        this.usersService.findById(peerObjectId.toString()),
      ]);
      if (sender && peer) {
        this.sendSchedulingNotification(
          PROPOSED_TIME_EMAIL_COPY,
          peer,
          extractFirstName(sender.name),
          when,
          meetingId,
        );
      }
    }

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

    // Agreeing on a time moves the meeting to that slot. MeetingsService
    // already emails both participants a fresh confirmation in that case.
    if (accept && proposal.proposedAt) {
      await this.meetingsService.reschedule(
        userId,
        meetingId,
        proposal.proposedAt,
      );
    } else if (!accept && proposal.proposedAt) {
      const [decliner, proposer] = await Promise.all([
        this.usersService.findById(userId),
        this.usersService.findById(proposal.senderId.toString()),
      ]);
      if (decliner && proposer) {
        this.sendSchedulingNotification(
          PROPOSAL_DECLINED_EMAIL_COPY,
          proposer,
          extractFirstName(decliner.name),
          proposal.proposedAt,
          meetingId,
        );
      }
    }

    return this.getThread(userId, meetingId);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Meeting, MeetingDocument } from './schemas/meeting.schema';
import { UsersService } from '../users/users.service';
import { MailService } from '../services/mail/mail.service';
import { AvailabilityService } from '../availability/availability.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { buildMeetingIcs } from './ics';
import {
  EMAIL_COPY,
  formatDayLabel,
  formatTimeRange,
  formatTimeZoneLabel,
} from './meeting-email';
import type { CreateMeetingInput, MeetingWithPeer } from './dto';
import { extractFirstName, toMeetingWithPeer } from './meetings.mapper';
import type { LocaleKey } from '@base-dashboard/shared';
import type { UserDocument } from '../users/schemas/user.schema';

const INSTANT_TTL_MS = 10 * 60 * 1000;
const SCHEDULED_TTL_MS = 60 * 60 * 1000;
const UPCOMING_GRACE_MS = 15 * 60 * 1000;
const UPCOMING_LIMIT = 50;
export const MEETING_DURATION_MINUTES = 60;
// How long the callee's ring stays live on their screen. Kept under the
// caller's 60s PEER_JOIN_TIMEOUT_MS so the caller's timeout is the backstop.
const RING_TTL_MS = 45 * 1000;

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectModel(Meeting.name)
    private meetingModel: Model<Meeting>,
    private usersService: UsersService,
    private mailService: MailService,
    private configService: ConfigService,
    private availabilityService: AvailabilityService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async create(
    initiatorId: string,
    dto: CreateMeetingInput,
  ): Promise<MeetingDocument> {
    const wantsInstant = dto.instant === true;
    const wantsScheduled = typeof dto.scheduledAt === 'string';
    if (wantsInstant && wantsScheduled) {
      throw new BadRequestException(
        'Provide either instant or scheduledAt, not both',
      );
    }
    if (!wantsInstant && !wantsScheduled) {
      throw new BadRequestException(
        'Provide either instant: true or scheduledAt',
      );
    }
    if (initiatorId === dto.peerUserId) {
      throw new BadRequestException('Cannot start a meeting with yourself');
    }
    if (!isValidObjectId(dto.peerUserId)) {
      throw new BadRequestException('Invalid peerUserId');
    }

    const peer = await this.usersService.findById(dto.peerUserId);
    if (!peer) throw new NotFoundException('Peer not found');

    const now = new Date();
    let scheduledAt: Date;
    let expiresAt: Date;
    if (wantsInstant) {
      scheduledAt = now;
      expiresAt = new Date(now.getTime() + INSTANT_TTL_MS);
    } else {
      scheduledAt = new Date(dto.scheduledAt ?? '');
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Invalid scheduledAt');
      }
      if (scheduledAt.getTime() <= now.getTime()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
      expiresAt = new Date(scheduledAt.getTime() + SCHEDULED_TTL_MS);
    }

    const doc = await this.meetingModel.create({
      participants: [
        new Types.ObjectId(initiatorId),
        new Types.ObjectId(dto.peerUserId),
      ],
      initiatorId: new Types.ObjectId(initiatorId),
      scheduledAt,
      expiresAt,
      cancelled: false,
      instant: wantsInstant,
    });

    this.logger.log(
      `Created meeting ${doc.id} initiator=${initiatorId} peer=${dto.peerUserId} instant=${wantsInstant}`,
    );

    if (wantsInstant) {
      // The click is the consent: someone who initiates an instant call is
      // implicitly available, so put them in the matching pool too. Failures
      // here shouldn't block the call from proceeding.
      try {
        await this.availabilityService.upsertByUserId(initiatorId, {
          isAvailableNow: true,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to mark initiator ${initiatorId} available after instant meeting ${doc.id}`,
          err,
        );
      }

      // Ring the peer in real time. Best-effort: a socket hiccup must never
      // block the caller from entering the room (the caller's 60s join timeout
      // is the backstop if the ring never lands).
      try {
        const initiator = await this.usersService.findById(initiatorId);
        this.realtimeGateway.emitIncomingCall(dto.peerUserId, {
          meetingId: doc.id,
          caller: {
            id: initiatorId,
            firstName: extractFirstName(initiator?.name ?? ''),
          },
          ringExpiresAt: new Date(Date.now() + RING_TTL_MS).toISOString(),
        });
      } catch (err) {
        this.logger.warn(
          `Failed to ring peer ${dto.peerUserId} for instant meeting ${doc.id}`,
          err,
        );
      }
    } else {
      const initiator = await this.usersService.findById(initiatorId);
      if (initiator) {
        this.sendCalendarInvitesFireAndForget(doc, initiator, peer);
      }
    }

    return doc;
  }

  private sendCalendarInvitesFireAndForget(
    meeting: MeetingDocument,
    initiator: UserDocument,
    peer: UserDocument,
  ): void {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const fromAddress = this.configService.getOrThrow<string>('SMTP_FROM');
    const joinUrl = `${frontendUrl}/call/${meeting.id}`;

    Promise.all(
      [
        { recipient: initiator, other: peer },
        { recipient: peer, other: initiator },
      ].map(({ recipient, other }) => {
        const locale: LocaleKey = recipient.locale === 'es' ? 'es' : 'en';
        const copy = EMAIL_COPY[locale];
        const otherFirst = extractFirstName(other.name);
        // Render the time in the recipient's own timezone, not UTC.
        const tz = recipient.timezone || 'UTC';
        const emailData = {
          otherFirst,
          dayLabel: formatDayLabel(meeting.scheduledAt, locale, tz),
          timeRange: formatTimeRange(
            meeting.scheduledAt,
            MEETING_DURATION_MINUTES,
            locale,
            tz,
          ),
          tzLabel: formatTimeZoneLabel(meeting.scheduledAt, locale, tz),
          joinUrl,
        };

        const ics = buildMeetingIcs({
          meetingId: meeting.id,
          organizerEmail: fromAddress,
          attendeeEmail: recipient.email,
          attendeeName: recipient.name,
          summary: copy.icsSummary(otherFirst),
          description: copy.icsDescription(joinUrl),
          scheduledAt: meeting.scheduledAt,
          durationMinutes: MEETING_DURATION_MINUTES,
          joinUrl,
        });

        return this.mailService.sendMail({
          to: recipient.email,
          subject: copy.subject(otherFirst),
          text: copy.bodyText(emailData),
          html: copy.bodyHtml(emailData),
          attachments: [
            {
              filename: ics.filename,
              content: ics.content,
              contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            },
          ],
        });
      }),
    ).catch((err) =>
      this.logger.error(
        `Failed to send calendar invites for meeting ${meeting.id}`,
        err,
      ),
    );
  }

  async findUpcomingForUser(userId: string): Promise<MeetingWithPeer[]> {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - UPCOMING_GRACE_MS);

    const docs = await this.meetingModel
      .find({
        participants: new Types.ObjectId(userId),
        cancelled: false,
        expiresAt: { $gt: now },
        scheduledAt: { $gt: graceCutoff },
      })
      .sort({ scheduledAt: 1 })
      .limit(UPCOMING_LIMIT);

    if (docs.length === 0) return [];

    const peerIds = docs.map((doc) => {
      const peerObjectId = doc.participants.find(
        (p) => p.toString() !== userId,
      );
      if (!peerObjectId) {
        throw new Error('Meeting missing peer participant');
      }
      return peerObjectId;
    });

    const peers = await this.usersService.findByIds(peerIds);
    const peerById = new Map(
      peers.map((p) => [p.id.toString(), extractFirstName(p.name)]),
    );

    return docs.map((doc, idx) => {
      const peerId = peerIds[idx].toString();
      const firstName = peerById.get(peerId) ?? '';
      return toMeetingWithPeer(doc, { id: peerId, firstName });
    });
  }

  // A "conversation" for the dashboard counter is a non-cancelled meeting the
  // user was part of whose scheduled start is in the past — i.e. one that has
  // actually happened. Future/upcoming meetings don't count yet.
  async countConversationsForUser(userId: string): Promise<number> {
    const now = new Date();
    return this.meetingModel.countDocuments({
      participants: new Types.ObjectId(userId),
      cancelled: false,
      scheduledAt: { $lte: now },
    });
  }

  async findByIdForParticipant(
    userId: string,
    meetingId: string,
  ): Promise<MeetingDocument> {
    if (!isValidObjectId(meetingId)) {
      throw new NotFoundException('Meeting not found');
    }
    const doc = await this.meetingModel.findById(meetingId);
    if (!doc) throw new NotFoundException('Meeting not found');
    if (doc.cancelled) throw new NotFoundException('Meeting not found');
    const isParticipant = doc.participants.some(
      (p) => p.toString() === userId,
    );
    if (!isParticipant) throw new NotFoundException('Meeting not found');
    return doc;
  }

  async findByIdWithPeerForParticipant(
    userId: string,
    meetingId: string,
  ): Promise<MeetingWithPeer> {
    const doc = await this.findByIdForParticipant(userId, meetingId);
    const peerObjectId = doc.participants.find(
      (p) => p.toString() !== userId,
    );
    if (!peerObjectId) throw new NotFoundException('Meeting not found');
    const peer = await this.usersService.findById(peerObjectId.toString());
    if (!peer) {
      return toMeetingWithPeer(doc, {
        id: peerObjectId.toString(),
        firstName: '',
      });
    }
    return toMeetingWithPeer(doc, {
      id: peer.id.toString(),
      firstName: extractFirstName(peer.name),
    });
  }

  // Move a scheduled meeting to a new confirmed time (e.g. after both sides
  // agreed on it in the scheduling thread) and re-send calendar invites for
  // the new slot. Instant meetings can't be rescheduled.
  async reschedule(
    userId: string,
    meetingId: string,
    newScheduledAt: Date,
  ): Promise<MeetingDocument> {
    const doc = await this.findByIdForParticipant(userId, meetingId);
    if (doc.instant) {
      throw new BadRequestException('Cannot reschedule an instant meeting');
    }
    if (Number.isNaN(newScheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }
    if (newScheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    doc.scheduledAt = newScheduledAt;
    doc.expiresAt = new Date(newScheduledAt.getTime() + SCHEDULED_TTL_MS);
    await doc.save();
    this.logger.log(
      `Rescheduled meeting ${meetingId} to ${newScheduledAt.toISOString()} by user=${userId}`,
    );

    const [initiator, peerObjectId] = [
      await this.usersService.findById(doc.initiatorId.toString()),
      doc.participants.find((p) => p.toString() !== doc.initiatorId.toString()),
    ];
    if (initiator && peerObjectId) {
      const peer = await this.usersService.findById(peerObjectId.toString());
      if (peer) this.sendCalendarInvitesFireAndForget(doc, initiator, peer);
    }

    return doc;
  }

  async cancel(userId: string, meetingId: string): Promise<void> {
    const doc = await this.findByIdForParticipant(userId, meetingId);
    doc.cancelled = true;
    await doc.save();
    this.logger.log(`Cancelled meeting ${meetingId} by user=${userId}`);
  }

  // The callee declines an instant call's ring. Only the non-initiator can
  // decline, and only instant meetings ring. Idempotent: re-declining is a
  // no-op so we don't double-notify the caller. Returns the doc so the caller
  // (CallsService) can notify the initiator over the socket.
  async markDeclined(
    userId: string,
    meetingId: string,
  ): Promise<MeetingDocument> {
    const doc = await this.findByIdForParticipant(userId, meetingId);
    if (!doc.instant) {
      throw new BadRequestException('Only instant calls can be declined');
    }
    if (doc.initiatorId.toString() === userId) {
      throw new BadRequestException('Cannot decline your own call');
    }
    if (doc.declinedAt) return doc;
    doc.declinedAt = new Date();
    await doc.save();
    this.logger.log(`Declined meeting ${meetingId} by user=${userId}`);
    return doc;
  }
}

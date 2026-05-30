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
import { buildMeetingIcs } from './ics';
import { EMAIL_COPY, formatDateLabel } from './meeting-email';
import type { CreateMeetingInput, MeetingWithPeer } from './dto';
import { extractFirstName, toMeetingWithPeer } from './meetings.mapper';
import type { LocaleKey } from '@base-dashboard/shared';
import type { UserDocument } from '../users/schemas/user.schema';

const INSTANT_TTL_MS = 10 * 60 * 1000;
const SCHEDULED_TTL_MS = 60 * 60 * 1000;
const UPCOMING_GRACE_MS = 15 * 60 * 1000;
const UPCOMING_LIMIT = 50;
const MEETING_DURATION_MINUTES = 60;

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
        const dateLabel = formatDateLabel(meeting.scheduledAt, locale);

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
          subject: copy.subject(otherFirst, dateLabel),
          text: copy.bodyText(otherFirst, dateLabel, joinUrl),
          html: copy.bodyHtml(otherFirst, dateLabel, joinUrl),
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

  async cancel(userId: string, meetingId: string): Promise<void> {
    const doc = await this.findByIdForParticipant(userId, meetingId);
    doc.cancelled = true;
    await doc.save();
    this.logger.log(`Cancelled meeting ${meetingId} by user=${userId}`);
  }
}

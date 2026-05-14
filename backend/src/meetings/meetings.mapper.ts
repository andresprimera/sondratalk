import type { Meeting, MeetingWithPeer } from './dto';
import type { MeetingDocument } from './schemas/meeting.schema';

export function toMeeting(doc: MeetingDocument): Meeting {
  return {
    id: doc.id,
    participants: doc.participants.map((p) => p.toString()),
    initiatorId: doc.initiatorId.toString(),
    scheduledAt: doc.scheduledAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    cancelled: doc.cancelled,
    instant: doc.instant,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toMeetingWithPeer(
  doc: MeetingDocument,
  peer: { id: string; firstName: string },
): MeetingWithPeer {
  return { ...toMeeting(doc), peer };
}

export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  const first = trimmed.split(/\s+/)[0];
  return first || fullName;
}

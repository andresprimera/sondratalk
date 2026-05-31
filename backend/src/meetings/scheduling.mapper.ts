import type { SchedulingMessage, SchedulingMessageKind } from './dto/scheduling';
import type { SchedulingMessageDocument } from './schemas/scheduling-message.schema';

export function toSchedulingMessage(
  doc: SchedulingMessageDocument,
): SchedulingMessage {
  return {
    id: doc.id,
    meetingId: doc.meetingId.toString(),
    senderId: doc.senderId.toString(),
    // eslint-disable-next-line no-restricted-syntax
    kind: doc.kind as SchedulingMessageKind,
    proposedAt: doc.proposedAt ? doc.proposedAt.toISOString() : undefined,
    replyToId: doc.replyToId ? doc.replyToId.toString() : undefined,
    accept: doc.accept,
    createdAt: doc.createdAt.toISOString(),
  };
}

import type {
  AvQuality,
  CirclesRelevant,
  ConversationFeedback as ConversationFeedbackDto,
  ConversationReport,
  ExchangedContact,
  ReportReason,
  TalkAgain,
} from '@base-dashboard/shared';
import type { ConversationFeedbackDocument } from './schemas/conversation-feedback.schema';

export function toConversationFeedback(
  doc: ConversationFeedbackDocument,
): ConversationFeedbackDto {
  const report: ConversationReport | undefined = doc.report
    ? {
        // eslint-disable-next-line no-restricted-syntax
        reason: doc.report.reason as ReportReason,
        detail: doc.report.detail,
      }
    : undefined;

  return {
    id: doc.id,
    meetingId: doc.meetingId.toString(),
    userId: doc.userId.toString(),
    // eslint-disable-next-line no-restricted-syntax
    talkAgain: doc.talkAgain as TalkAgain | undefined,
    doorOpen: doc.doorOpen,
    doorNote: doc.doorNote,
    feeling: doc.feeling,
    // eslint-disable-next-line no-restricted-syntax
    circlesRelevant: doc.circlesRelevant as CirclesRelevant | undefined,
    // eslint-disable-next-line no-restricted-syntax
    exchangedContact: doc.exchangedContact as ExchangedContact | undefined,
    // eslint-disable-next-line no-restricted-syntax
    avQuality: doc.avQuality as AvQuality | undefined,
    matchRating: doc.matchRating,
    privateNotes: doc.privateNotes,
    report,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

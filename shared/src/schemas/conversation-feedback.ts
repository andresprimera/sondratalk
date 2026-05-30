import { z } from "zod/v4";

export const talkAgainEnum = z.enum(["yes", "maybe", "no"]);
export type TalkAgain = z.infer<typeof talkAgainEnum>;

export const circlesRelevantEnum = z.enum(["yes", "somewhat", "not_really"]);
export type CirclesRelevant = z.infer<typeof circlesRelevantEnum>;

export const exchangedContactEnum = z.enum(["yes", "no"]);
export type ExchangedContact = z.infer<typeof exchangedContactEnum>;

export const avQualityEnum = z.enum([
  "good",
  "minor_issues",
  "significant_problems",
]);
export type AvQuality = z.infer<typeof avQualityEnum>;

export const reportReasonEnum = z.enum([
  "disrespectful",
  "inappropriate",
  "no_show",
  "solicitation",
  "unsafe",
  "other",
]);
export type ReportReason = z.infer<typeof reportReasonEnum>;

export const conversationReportSchema = z.object({
  reason: reportReasonEnum,
  detail: z.string().max(2000).optional(),
});
export type ConversationReport = z.infer<typeof conversationReportSchema>;

export const submitConversationFeedbackSchema = z.object({
  meetingId: z.string().min(1, "meetingId is required"),
  talkAgain: talkAgainEnum.optional(),
  doorOpen: z.boolean().optional(),
  doorNote: z.string().max(1000).optional(),
  feeling: z.string().max(4000).optional(),
  circlesRelevant: circlesRelevantEnum.optional(),
  exchangedContact: exchangedContactEnum.optional(),
  avQuality: avQualityEnum.optional(),
  matchRating: z.number().int().min(1).max(5).optional(),
  privateNotes: z.string().max(4000).optional(),
  report: conversationReportSchema.optional(),
});
export type SubmitConversationFeedbackInput = z.infer<
  typeof submitConversationFeedbackSchema
>;

export const conversationFeedbackSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  userId: z.string(),
  talkAgain: talkAgainEnum.optional(),
  doorOpen: z.boolean(),
  doorNote: z.string().optional(),
  feeling: z.string().optional(),
  circlesRelevant: circlesRelevantEnum.optional(),
  exchangedContact: exchangedContactEnum.optional(),
  avQuality: avQualityEnum.optional(),
  matchRating: z.number().int().optional(),
  privateNotes: z.string().optional(),
  report: conversationReportSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConversationFeedback = z.infer<typeof conversationFeedbackSchema>;

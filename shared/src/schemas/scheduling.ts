import { z } from "zod/v4";

// A meeting's scheduling thread is a *restricted* chat: participants can't
// free-type, they can only exchange structured options. There are two message
// kinds — a `time_proposal` ("9:30am?") and a `proposal_response` ("yes"/"no")
// answering a specific proposal. Accepting a proposal moves the meeting time.
export const schedulingMessageKindEnum = z.enum([
  "time_proposal",
  "proposal_response",
]);
export type SchedulingMessageKind = z.infer<typeof schedulingMessageKindEnum>;

export const schedulingMessageSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  senderId: z.string(),
  kind: schedulingMessageKindEnum,
  // Present on `time_proposal` — the ISO instant being proposed.
  proposedAt: z.string().optional(),
  // Present on `proposal_response` — the proposal being answered, and the
  // yes/no answer.
  replyToId: z.string().optional(),
  accept: z.boolean().optional(),
  createdAt: z.string(),
});
export type SchedulingMessage = z.infer<typeof schedulingMessageSchema>;

export const proposeTimeSchema = z.object({
  proposedAt: z.iso.datetime(),
});
export type ProposeTimeInput = z.infer<typeof proposeTimeSchema>;

export const respondToProposalSchema = z.object({
  replyToId: z.string().min(1, "replyToId is required"),
  accept: z.boolean(),
});
export type RespondToProposalInput = z.infer<typeof respondToProposalSchema>;

export const schedulingThreadResponseSchema = z.object({
  messages: z.array(schedulingMessageSchema),
  // The meeting's currently confirmed time, so the thread can mark which
  // proposal (if any) is the active one.
  scheduledAt: z.string(),
  peer: z.object({
    id: z.string(),
    firstName: z.string(),
  }),
});
export type SchedulingThreadResponse = z.infer<
  typeof schedulingThreadResponseSchema
>;

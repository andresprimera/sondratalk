import { z } from "zod/v4";
import { circleSchema } from "./circle";

export const findTalkMatchInputSchema = z.object({
  circleIds: z.array(z.string().min(1)).min(1, "Pick at least one circle"),
});
export type FindTalkMatchInput = z.infer<typeof findTalkMatchInputSchema>;

// `heard` accepts the same input shape as `talk` for now.
export const findHeardMatchInputSchema = findTalkMatchInputSchema;
export type FindHeardMatchInput = FindTalkMatchInput;

export const projectedSlotSchema = z.object({
  startsAt: z.string(),
  requesterDate: z.string(),
  requesterTime: z.string(),
});
export type ProjectedSlot = z.infer<typeof projectedSlotSchema>;

export const matchCandidateSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  sharedCircles: z.array(circleSchema),
  availableNow: z.boolean(),
  slots: z.array(projectedSlotSchema),
});
export type MatchCandidate = z.infer<typeof matchCandidateSchema>;

export const heardCandidateSchema = matchCandidateSchema.extend({
  hostExp: z.number().int().nonnegative(),
});
export type HeardCandidate = z.infer<typeof heardCandidateSchema>;

export const talkMatchesResponseSchema = z.object({
  candidates: z.array(matchCandidateSchema),
});
export type TalkMatchesResponse = z.infer<typeof talkMatchesResponseSchema>;

export const heardMatchesResponseSchema = z.object({
  candidates: z.array(heardCandidateSchema),
});
export type HeardMatchesResponse = z.infer<typeof heardMatchesResponseSchema>;

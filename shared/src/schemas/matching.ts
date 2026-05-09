import { z } from "zod/v4";
import { circleSchema } from "./circle";

export const findTalkMatchInputSchema = z.object({
  circleIds: z.array(z.string().min(1)).min(1, "Pick at least one circle"),
});
export type FindTalkMatchInput = z.infer<typeof findTalkMatchInputSchema>;

// `heard` accepts the same input shape as `talk` for now.
export const findHeardMatchInputSchema = findTalkMatchInputSchema;
export type FindHeardMatchInput = FindTalkMatchInput;

export const talkMatchSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  sharedCircles: z.array(circleSchema),
});
export type TalkMatch = z.infer<typeof talkMatchSchema>;

export const heardMatchSchema = talkMatchSchema.extend({
  hostExp: z.number().int().nonnegative(),
});
export type HeardMatch = z.infer<typeof heardMatchSchema>;

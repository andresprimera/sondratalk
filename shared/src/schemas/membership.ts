import { z } from "zod/v4";

export const updateMyCirclesSchema = z.object({
  circleIds: z
    .array(z.string().min(1))
    .max(50, "Too many circles selected"),
  // Free-text circle names the user typed themselves (onboarding "Add your
  // own…"). The backend find-or-creates a shared public circle per label so
  // they persist and can match other users who add the same one.
  customCircleLabels: z
    .array(z.string().trim().min(1).max(80))
    .max(50, "Too many circles selected")
    .optional(),
});

export type UpdateMyCirclesInput = z.infer<typeof updateMyCirclesSchema>;

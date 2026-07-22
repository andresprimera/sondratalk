import { z } from "zod/v4";

export const updateMyCirclesSchema = z.object({
  circleIds: z
    .array(z.string().min(1))
    .max(50, "Too many circles selected"),
});

export type UpdateMyCirclesInput = z.infer<typeof updateMyCirclesSchema>;

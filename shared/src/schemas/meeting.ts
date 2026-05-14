import { z } from "zod/v4";

export const meetingSchema = z.object({
  id: z.string(),
  participants: z.array(z.string()).length(2),
  initiatorId: z.string(),
  scheduledAt: z.string(),
  expiresAt: z.string(),
  cancelled: z.boolean(),
  instant: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const createMeetingSchema = z.object({
  peerUserId: z.string().min(1, "peerUserId is required"),
  scheduledAt: z.iso.datetime().optional(),
  instant: z.boolean().optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const meetingWithPeerSchema = meetingSchema.extend({
  peer: z.object({
    id: z.string(),
    firstName: z.string(),
  }),
});
export type MeetingWithPeer = z.infer<typeof meetingWithPeerSchema>;

export const upcomingMeetingsResponseSchema = z.object({
  meetings: z.array(meetingWithPeerSchema),
});
export type UpcomingMeetingsResponse = z.infer<typeof upcomingMeetingsResponseSchema>;

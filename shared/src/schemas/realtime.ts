import { z } from "zod/v4";

// Socket.io event payloads for the real-time call ring. These cross the
// network boundary (server -> client), so they live in shared as the single
// source of truth and are validated on the client with safeParse.

export const incomingCallPayloadSchema = z.object({
  meetingId: z.string().min(1),
  caller: z.object({
    id: z.string().min(1),
    firstName: z.string(),
  }),
  ringExpiresAt: z.iso.datetime(),
});
export type IncomingCallPayload = z.infer<typeof incomingCallPayloadSchema>;

export const callDeclinedPayloadSchema = z.object({
  meetingId: z.string().min(1),
});
export type CallDeclinedPayload = z.infer<typeof callDeclinedPayloadSchema>;

// Socket event names — shared so both the gateway and the client agree.
export const CALL_SOCKET_EVENTS = {
  incomingCall: "incoming-call",
  callDeclined: "call-declined",
} as const;

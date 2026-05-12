import { z } from "zod/v4";

export const callTokenRequestSchema = z.object({
  peerUserId: z.string().min(1, "peerUserId is required"),
});
export type CallTokenRequest = z.infer<typeof callTokenRequestSchema>;

export const callTokenResponseSchema = z.object({
  token: z.string().min(1),
  url: z.string().min(1),
  roomName: z.string().min(1),
  identity: z.string().min(1),
});
export type CallTokenResponse = z.infer<typeof callTokenResponseSchema>;

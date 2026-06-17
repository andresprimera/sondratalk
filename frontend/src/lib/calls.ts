import {
  type CallTokenRequest,
  type CallTokenResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchCallTokenApi(
  input: CallTokenRequest,
): Promise<CallTokenResponse> {
  const res = await authFetch("/api/calls/token", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

// Decline an incoming instant-call ring. Returns 204 (no body); the backend
// notifies the caller over the socket.
export async function declineCallApi(meetingId: string): Promise<void> {
  await authFetch(`/api/calls/${meetingId}/decline`, { method: "POST" })
}

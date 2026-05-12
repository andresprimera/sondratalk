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

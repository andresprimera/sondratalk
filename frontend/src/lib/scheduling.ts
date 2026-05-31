import {
  type ProposeTimeInput,
  type RespondToProposalInput,
  type SchedulingThreadResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function fetchSchedulingThreadApi(
  meetingId: string,
): Promise<SchedulingThreadResponse> {
  const res = await authFetch(`/api/meetings/${meetingId}/scheduling`)
  return res.json()
}

export async function proposeTimeApi(
  meetingId: string,
  input: ProposeTimeInput,
): Promise<SchedulingThreadResponse> {
  const res = await authFetch(
    `/api/meetings/${meetingId}/scheduling/proposals`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
  return res.json()
}

export async function respondToProposalApi(
  meetingId: string,
  input: RespondToProposalInput,
): Promise<SchedulingThreadResponse> {
  const res = await authFetch(
    `/api/meetings/${meetingId}/scheduling/responses`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
  return res.json()
}

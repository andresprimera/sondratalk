import {
  type AdminMeeting,
  type ConversationStats,
  type CreateMeetingInput,
  type Meeting,
  type MeetingWithPeer,
  type PaginatedResponse,
  type UpcomingMeetingsResponse,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function createMeetingApi(
  input: CreateMeetingInput,
): Promise<Meeting> {
  const res = await authFetch("/api/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function fetchUpcomingMeetingsApi(): Promise<UpcomingMeetingsResponse> {
  const res = await authFetch("/api/meetings/upcoming")
  return res.json()
}

export async function fetchConversationStatsApi(): Promise<ConversationStats> {
  const res = await authFetch("/api/meetings/stats")
  return res.json()
}

export async function fetchMeetingByIdApi(
  id: string,
): Promise<MeetingWithPeer> {
  const res = await authFetch(`/api/meetings/${id}`)
  return res.json()
}

export async function cancelMeetingApi(id: string): Promise<void> {
  await authFetch(`/api/meetings/${id}/cancel`, {
    method: "POST",
  })
}

export async function fetchAdminMeetingsApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<AdminMeeting>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/meetings/admin?${params}`)
  return res.json()
}

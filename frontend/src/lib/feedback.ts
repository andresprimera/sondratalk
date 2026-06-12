import {
  type AdminFeedback,
  type ConversationFeedback,
  type PaginatedResponse,
  type SubmitConversationFeedbackInput,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function submitConversationFeedbackApi(
  input: SubmitConversationFeedbackInput,
): Promise<ConversationFeedback> {
  const res = await authFetch("/api/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function fetchAdminFeedbackApi(
  page: number,
  limit: number,
): Promise<PaginatedResponse<AdminFeedback>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await authFetch(`/api/feedback?${params}`)
  return res.json()
}

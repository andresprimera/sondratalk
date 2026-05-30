import {
  type ConversationFeedback,
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

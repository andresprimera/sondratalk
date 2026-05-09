import {
  type FindHeardMatchInput,
  type FindTalkMatchInput,
  type HeardMatch,
  type TalkMatch,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export async function findTalkMatchApi(
  input: FindTalkMatchInput,
): Promise<TalkMatch> {
  const res = await authFetch("/api/matching/talk", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function findHeardMatchApi(
  input: FindHeardMatchInput,
): Promise<HeardMatch> {
  const res = await authFetch("/api/matching/heard", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

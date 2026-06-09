import { useMutation } from "@tanstack/react-query"
import { findTalkMatchApi } from "@/lib/matching"

export function useFindTalkMatch() {
  return useMutation({
    mutationFn: findTalkMatchApi,
  })
}

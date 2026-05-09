import { useMutation } from "@tanstack/react-query"
import { findHeardMatchApi, findTalkMatchApi } from "@/lib/matching"

export function useFindTalkMatch() {
  return useMutation({
    mutationFn: findTalkMatchApi,
  })
}

export function useFindHeardMatch() {
  return useMutation({
    mutationFn: findHeardMatchApi,
  })
}

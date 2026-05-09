import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  type Availability,
  fetchMyAvailabilityApi,
  updateMyAvailabilityApi,
} from "@/lib/availability"

export const myAvailabilityKey = ["users", "me", "availability"] as const

export function useMyAvailabilityQuery() {
  return useQuery({
    queryKey: myAvailabilityKey,
    queryFn: fetchMyAvailabilityApi,
  })
}

export function useUpdateMyAvailability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateMyAvailabilityApi,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: myAvailabilityKey })
      const prev = qc.getQueryData<Availability>(myAvailabilityKey)
      if (prev) {
        qc.setQueryData<Availability>(myAvailabilityKey, {
          windows: input.windows ?? prev.windows,
          isAvailableNow: input.isAvailableNow ?? prev.isAvailableNow,
        })
      }
      return { prev }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(myAvailabilityKey, ctx.prev)
      const message = err instanceof Error ? err.message : "Failed to save"
      toast.error(message)
    },
    onSuccess: (data) => {
      qc.setQueryData(myAvailabilityKey, data)
    },
  })
}

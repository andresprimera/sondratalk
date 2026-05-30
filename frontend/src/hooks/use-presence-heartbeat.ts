import { useEffect } from "react"
import { heartbeatPresenceApi } from "@/lib/presence"
import { useMyAvailabilityQuery } from "@/hooks/use-my-availability"

// Backend treats anyone whose availableNowSetAt is older than 2 minutes as
// stale. Beating at 60s leaves one missed cycle of slack before they drop
// out of matching.
const HEARTBEAT_INTERVAL_MS = 60_000

export function usePresenceHeartbeat() {
  const { data } = useMyAvailabilityQuery()
  const isAvailableNow = data?.isAvailableNow ?? false

  useEffect(() => {
    if (!isAvailableNow) return

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const beat = () => {
      if (cancelled) return
      // Mutation failures are non-fatal: the worst case is the user drops
      // out of matching for two minutes, which is the correct behavior.
      heartbeatPresenceApi().catch(() => {})
    }

    const start = () => {
      if (timer) return
      beat()
      timer = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    }

    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [isAvailableNow])
}

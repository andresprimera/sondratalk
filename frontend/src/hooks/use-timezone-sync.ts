import { useEffect, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { updateTimezoneApi } from "@/lib/profile"
import { getBrowserTimezone, getTimezoneByIana } from "@/lib/timezones"

// Accounts created before the app captured timezones at signup (and seeded /
// bootstrap accounts) keep the schema default of "UTC". That makes their
// confirmation emails render times in UTC instead of the recipient's local
// zone. When an authenticated session lands with the bare default still in
// place, silently backfill the browser's real timezone so future emails — and
// matching — use it. We only ever replace the never-set "UTC" default, never a
// zone the user actually chose.
const DEFAULT_TIMEZONE = "UTC"

export function useTimezoneSync(): void {
  const { user, updateUser } = useAuth()
  const attempted = useRef(false)
  const { mutate } = useMutation({ mutationFn: updateTimezoneApi })

  useEffect(() => {
    if (attempted.current) return
    if (!user || user.timezone !== DEFAULT_TIMEZONE) return
    const detected = getBrowserTimezone()
    if (!detected || detected === DEFAULT_TIMEZONE) return
    attempted.current = true
    const city = getTimezoneByIana(detected)?.city
    mutate(
      { timezone: detected, ...(city ? { city } : {}) },
      { onSuccess: (updated) => updateUser(updated) },
    )
  }, [user, updateUser, mutate])
}

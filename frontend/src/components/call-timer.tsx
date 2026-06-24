import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { formatCallDuration } from "@/lib/format-duration"

// Live call duration, ticking every second from when the room connected.
export function CallTimer({ startedAt }: { startedAt: number }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      className="font-mono text-sm text-muted-foreground tabular-nums"
      aria-label={t("Call duration")}
    >
      {formatCallDuration(now - startedAt)}
    </span>
  )
}

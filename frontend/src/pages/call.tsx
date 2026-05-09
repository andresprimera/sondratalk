import { useNavigate, useLocation, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { Mic, PhoneOff, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function readCallState(state: unknown): { name?: string; circles?: string[] } {
  if (!state || typeof state !== "object") return {}
  const out: { name?: string; circles?: string[] } = {}
  if ("name" in state && typeof state.name === "string") {
    out.name = state.name
  }
  if (
    "circles" in state &&
    Array.isArray(state.circles) &&
    state.circles.every((c): c is string => typeof c === "string")
  ) {
    out.circles = state.circles
  }
  return out
}

export default function CallPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const location = useLocation()
  const { name, circles = [] } = readCallState(location.state)

  const displayName = name ?? t("Your match")

  function endCall() {
    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-5">
        <div>
          <div className="text-[0.6875rem] tracking-widest text-primary/80 uppercase">
            {t("Connecting…")}
          </div>
          <h1 className="mt-1 text-2xl">{displayName}</h1>
          {circles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {circles.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground/60 italic">
          {t("Call ID")}: {params.id}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-6">
        <div className="flex aspect-video w-full max-w-4xl flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted text-center">
          <Video className="size-12 text-muted-foreground/40" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t("Video call placeholder")}
          </p>
          <p className="text-xs text-muted-foreground/60 italic">
            {t("Real-time audio and video will land in a follow-up.")}
          </p>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-3 px-6 pb-10">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={t("Mute (placeholder)")}
          disabled
        >
          <Mic />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={t("Toggle camera (placeholder)")}
          disabled
        >
          <Video />
        </Button>
        <Button
          variant="destructive"
          size="lg"
          onClick={endCall}
          aria-label={t("End call")}
        >
          <PhoneOff /> {t("End call")}
        </Button>
      </footer>
    </div>
  )
}

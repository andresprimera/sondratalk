import { useNavigate, useLocation, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, PhoneOff } from "lucide-react"
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCallTokenApi } from "@/lib/calls"

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
  const peerUserId = params.id ?? ""

  const tokenQuery = useQuery({
    queryKey: ["calls", "token", peerUserId] as const,
    queryFn: () => fetchCallTokenApi({ peerUserId }),
    enabled: peerUserId.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const displayName = name ?? t("Your match")

  function endCall() {
    navigate("/dashboard")
  }

  const statusLabel = !peerUserId
    ? t("Couldn't connect")
    : tokenQuery.isLoading
      ? t("Connecting…")
      : tokenQuery.isError
        ? t("Couldn't connect")
        : t("Connected")

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-5">
        <div>
          <div className="text-[0.6875rem] tracking-widest text-primary/80 uppercase">
            {statusLabel}
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
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-6">
        {!peerUserId ? (
          <EmptyState
            title={t("No peer specified")}
            description={t("This call link is missing a participant id.")}
            onLeave={endCall}
          />
        ) : tokenQuery.isLoading ? (
          <Skeleton className="aspect-video w-full max-w-4xl rounded-2xl" />
        ) : tokenQuery.isError ? (
          <ErrorState
            message={
              tokenQuery.error instanceof Error
                ? tokenQuery.error.message
                : t("Couldn't reach the call service.")
            }
            onRetry={() => tokenQuery.refetch()}
            onLeave={endCall}
          />
        ) : tokenQuery.data ? (
          <LiveKitRoom
            token={tokenQuery.data.token}
            serverUrl={tokenQuery.data.url}
            connect
            video
            audio
            onDisconnected={endCall}
            className="w-full max-w-4xl"
          >
            <RoomAudioRenderer />
            <VideoConference />
          </LiveKitRoom>
        ) : null}
      </main>

      <footer className="flex items-center justify-center gap-3 px-6 pb-10">
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

interface EmptyStateProps {
  title: string
  description: string
  onLeave: () => void
}

function EmptyState({ title, description, onLeave }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex aspect-video w-full max-w-4xl flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted text-center">
      <AlertCircleIcon className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 italic">{description}</p>
      <Button variant="outline" size="sm" onClick={onLeave}>
        {t("Back to dashboard")}
      </Button>
    </div>
  )
}

interface ErrorStateProps {
  message: string
  onRetry: () => void
  onLeave: () => void
}

function ErrorState({ message, onRetry, onLeave }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex aspect-video w-full max-w-4xl flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted text-center">
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <p className="text-sm text-foreground">
        {t("We couldn't start the call.")}
      </p>
      <p className="text-xs text-muted-foreground/60 italic">{message}</p>
      <div className="flex gap-2">
        <Button onClick={onRetry}>{t("Try again")}</Button>
        <Button variant="outline" onClick={onLeave}>
          {t("Back to dashboard")}
        </Button>
      </div>
    </div>
  )
}

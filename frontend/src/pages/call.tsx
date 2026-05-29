import { useNavigate, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import {
  AlertCircleIcon,
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track } from "livekit-client"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { fetchCallTokenApi } from "@/lib/calls"
import { fetchMeetingByIdApi } from "@/lib/meetings"
import i18n from "@/lib/i18n"

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("")
  return initials || "?"
}

export default function CallPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const params = useParams<{ meetingId: string }>()
  const meetingId = params.meetingId ?? ""

  const meetingQuery = useQuery({
    queryKey: ["meetings", meetingId] as const,
    queryFn: () => fetchMeetingByIdApi(meetingId),
    enabled: meetingId.length > 0,
    retry: false,
  })

  const tokenQuery = useQuery({
    queryKey: ["calls", "token", meetingId] as const,
    queryFn: () => fetchCallTokenApi({ meetingId }),
    enabled: meetingId.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const peerName = meetingQuery.data?.peer.firstName || t("Your match")
  const peerInitials = getInitials(meetingQuery.data?.peer.firstName)
  const localInitials = getInitials(user?.name)

  const subline = (() => {
    if (!meetingQuery.data) return null
    const scheduled = new Date(meetingQuery.data.scheduledAt)
    if (meetingQuery.data.instant) {
      return t("Started at {{time}}", {
        time: scheduled.toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })
    }
    return t("Scheduled for {{when}}", {
      when: scheduled.toLocaleString(i18n.language, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })
  })()

  function endCall() {
    navigate("/dashboard")
  }

  const statusLabel = !meetingId
    ? t("Couldn't connect")
    : tokenQuery.isLoading
      ? t("Connecting…")
      : tokenQuery.isError
        ? t("Couldn't connect")
        : t("Connected")

  const inRoom = Boolean(meetingId && tokenQuery.data)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <div className="text-[0.6875rem] tracking-widest text-primary/80 uppercase">
            {statusLabel}
          </div>
          <h1 className="mt-1 text-2xl">{peerName}</h1>
          {subline && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {subline}
            </p>
          )}
        </div>
      </header>

      {inRoom && tokenQuery.data ? (
        <LiveKitRoom
          token={tokenQuery.data.token}
          serverUrl={tokenQuery.data.url}
          connect
          video
          audio
          onDisconnected={endCall}
          className="contents"
        >
          <RoomAudioRenderer />
          <CallMain>
            <VideoStage
              peerName={peerName}
              peerInitials={peerInitials}
              localInitials={localInitials}
            />
          </CallMain>
          <CallFooter live onEndCall={endCall} />
        </LiveKitRoom>
      ) : (
        <>
          <CallMain>
            {!meetingId ? (
              <StageMessage
                tone="error"
                title={t("No meeting specified")}
                description={t("This call link is missing a meeting id.")}
              />
            ) : tokenQuery.isError ? (
              <StageMessage
                tone="error"
                title={t("We couldn't start the call.")}
                description={
                  tokenQuery.error instanceof Error
                    ? tokenQuery.error.message
                    : t("Couldn't reach the call service.")
                }
                action={
                  <Button onClick={() => tokenQuery.refetch()}>
                    {t("Try again")}
                  </Button>
                }
              />
            ) : (
              <ConnectingPlaceholder
                peerName={peerName}
                peerInitials={peerInitials}
                localInitials={localInitials}
              />
            )}
          </CallMain>
          <CallFooter live={false} onEndCall={endCall} />
        </>
      )}
    </div>
  )
}

function CallMain({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center px-6 pb-6">
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-3xl",
          "bg-linear-to-br from-secondary/90 via-secondary to-secondary/70",
          "shadow-2xl shadow-primary/15 ring-1 ring-border/60"
        )}
        style={{
          width: "min(100%, 1024px, calc((100svh - 12rem) * 16 / 9))",
        }}
      >
        {children}
      </div>
    </main>
  )
}

interface VideoStageProps {
  peerName: string
  peerInitials: string
  localInitials: string
}

function VideoStage({ peerName, peerInitials, localInitials }: VideoStageProps) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const { isCameraEnabled } = useLocalParticipant()

  const remoteTrack = tracks.find(
    (track) => !track.participant.isLocal && track.publication,
  )
  const localTrack = tracks.find(
    (track) => track.participant.isLocal && track.publication,
  )

  return (
    <>
      {remoteTrack ? (
        <VideoTrack
          trackRef={remoteTrack}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <RemotePlaceholder
          peerName={peerName}
          peerInitials={peerInitials}
          waiting
        />
      )}

      <div
        className={cn(
          "absolute right-4 bottom-4 aspect-video w-1/4 max-w-55 min-w-35",
          "overflow-hidden rounded-xl bg-secondary",
          "shadow-lg shadow-primary/20 ring-2 ring-background/80"
        )}
      >
        {localTrack && isCameraEnabled ? (
          <VideoTrack
            trackRef={localTrack}
            className="size-full -scale-x-100 object-cover"
          />
        ) : (
          <CornerPlaceholder initials={localInitials} />
        )}
      </div>
    </>
  )
}

interface RemotePlaceholderProps {
  peerName: string
  peerInitials: string
  waiting?: boolean
}

function RemotePlaceholder({
  peerName,
  peerInitials,
  waiting,
}: RemotePlaceholderProps) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center text-secondary-foreground">
      <Avatar className="size-28 ring-4 ring-background/40">
        <AvatarFallback className="bg-background/20 text-3xl text-secondary-foreground">
          {peerInitials}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <p className="text-lg font-medium">{peerName}</p>
        {waiting && (
          <p className="flex items-center justify-center gap-2 text-sm text-secondary-foreground/70">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {t("Waiting for {{name}} to join…", { name: peerName })}
          </p>
        )}
      </div>
    </div>
  )
}

function CornerPlaceholder({ initials }: { initials: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-secondary text-secondary-foreground">
      <Avatar className="size-10">
        <AvatarFallback className="bg-background/20 text-secondary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <p className="text-[0.6875rem] tracking-wide text-secondary-foreground/70 uppercase">
        {t("Camera off")}
      </p>
    </div>
  )
}

interface ConnectingPlaceholderProps {
  peerName: string
  peerInitials: string
  localInitials: string
}

function ConnectingPlaceholder({
  peerName,
  peerInitials,
  localInitials,
}: ConnectingPlaceholderProps) {
  const { t } = useTranslation()
  return (
    <>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center text-secondary-foreground">
        <Avatar className="size-28 ring-4 ring-background/40">
          <AvatarFallback className="bg-background/20 text-3xl text-secondary-foreground">
            {peerInitials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <p className="text-lg font-medium">{peerName}</p>
          <p className="flex items-center justify-center gap-2 text-sm text-secondary-foreground/70">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {t("Connecting to {{name}}…", { name: peerName })}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "absolute right-4 bottom-4 aspect-video w-1/4 max-w-55 min-w-35",
          "overflow-hidden rounded-xl bg-secondary",
          "shadow-lg shadow-primary/20 ring-2 ring-background/80"
        )}
      >
        <CornerPlaceholder initials={localInitials} />
      </div>
    </>
  )
}

interface StageMessageProps {
  tone: "error" | "info"
  title: string
  description: string
  action?: ReactNode
}

function StageMessage({ tone, title, description, action }: StageMessageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertCircleIcon
        className={cn(
          "size-8",
          tone === "error" ? "text-destructive" : "text-secondary-foreground/60"
        )}
        aria-hidden
      />
      <p className="text-sm text-secondary-foreground">{title}</p>
      <p className="max-w-md text-xs text-secondary-foreground/70 italic">
        {description}
      </p>
      <div className="mt-2 flex gap-2">
        {action}
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          {t("Back to dashboard")}
        </Button>
      </div>
    </div>
  )
}

interface CallFooterProps {
  live: boolean
  onEndCall: () => void
}

function CallFooter({ live, onEndCall }: CallFooterProps) {
  const { t } = useTranslation()
  return (
    <footer className="flex items-center justify-center gap-3 px-6 pb-6">
      {live ? (
        <>
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            className={controlButtonClass}
            aria-label={t("Microphone")}
          >
            <MicIcon className="size-5 data-[lk-enabled=false]:hidden" />
            <MicOffIcon className="hidden size-5 data-[lk-enabled=false]:block" />
          </TrackToggle>
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={false}
            className={controlButtonClass}
            aria-label={t("Camera")}
          >
            <VideoIcon className="size-5 data-[lk-enabled=false]:hidden" />
            <VideoOffIcon className="hidden size-5 data-[lk-enabled=false]:block" />
          </TrackToggle>
        </>
      ) : (
        <>
          <DisabledControl ariaLabel={t("Microphone")}>
            <MicIcon className="size-5" />
          </DisabledControl>
          <DisabledControl ariaLabel={t("Camera")}>
            <VideoIcon className="size-5" />
          </DisabledControl>
        </>
      )}
      <Button
        variant="destructive"
        size="lg"
        onClick={onEndCall}
        aria-label={t("End call")}
        className="rounded-full px-6"
      >
        <PhoneOffIcon /> {t("End call")}
      </Button>
    </footer>
  )
}

const controlButtonClass = cn(
  "inline-flex size-12 items-center justify-center rounded-full",
  "bg-secondary text-secondary-foreground transition-colors",
  "ring-1 ring-border/60 hover:bg-secondary/80",
  "data-[lk-enabled=false]:bg-destructive data-[lk-enabled=false]:text-destructive-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
)

interface DisabledControlProps {
  ariaLabel: string
  children: ReactNode
}

function DisabledControl({ ariaLabel, children }: DisabledControlProps) {
  return (
    <button
      type="button"
      disabled
      aria-label={ariaLabel}
      className={cn(controlButtonClass, "cursor-not-allowed opacity-50")}
    >
      {children}
    </button>
  )
}

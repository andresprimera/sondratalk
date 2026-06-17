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
  useRemoteParticipants,
  useTracks,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track } from "livekit-client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useCallSocket } from "@/hooks/use-call-socket"
import { fetchCallTokenApi } from "@/lib/calls"
import { fetchMeetingByIdApi } from "@/lib/meetings"
import i18n from "@/lib/i18n"
import {
  CALL_SOCKET_EVENTS,
  callDeclinedPayloadSchema,
} from "@base-dashboard/shared"

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((p) => p[0]?.toUpperCase() ?? "").join("")
  return initials || "?"
}

// If the peer hasn't joined within this window after the LiveKit room
// connects, we assume they're not coming and offer to bail out. Matching
// only picks fresh-presence users, but the gap between match and join is
// the last place a "they're not actually here" case can slip through.
const PEER_JOIN_TIMEOUT_MS = 60_000

export default function CallPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const params = useParams<{ meetingId: string }>()
  const meetingId = params.meetingId ?? ""
  const [peerTimedOut, setPeerTimedOut] = useState(false)
  const [peerDeclined, setPeerDeclined] = useState(false)
  const { socket } = useCallSocket()

  // The callee can decline the ring. When they do, the backend pushes
  // call-declined so we can bail out immediately instead of waiting out the
  // 60s join timeout.
  useEffect(() => {
    if (!socket || !meetingId) return
    const handleDeclined = (raw: unknown) => {
      const parsed = callDeclinedPayloadSchema.safeParse(raw)
      if (parsed.success && parsed.data.meetingId === meetingId) {
        setPeerDeclined(true)
      }
    }
    socket.on(CALL_SOCKET_EVENTS.callDeclined, handleDeclined)
    return () => {
      socket.off(CALL_SOCKET_EVENTS.callDeclined, handleDeclined)
    }
  }, [socket, meetingId])

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
    // After a call, send people to the post-conversation wrap-up so they can
    // leave feedback while it's fresh. Fall back to the dashboard if we somehow
    // don't have a meeting id to attach the feedback to.
    navigate(meetingId ? `/call/${meetingId}/wrap-up` : "/dashboard")
  }

  const statusLabel = !meetingId
    ? t("Couldn't connect")
    : tokenQuery.isLoading
      ? t("Connecting…")
      : tokenQuery.isError
        ? t("Couldn't connect")
        : t("Connected")

  const inRoom =
    Boolean(meetingId && tokenQuery.data) && !peerTimedOut && !peerDeclined

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <div className="text-[0.6875rem] tracking-widest text-primary/80 uppercase">
            {statusLabel}
          </div>
          <h1 className="mt-1 text-2xl">{peerName}</h1>
          {subline && (
            <p className="mt-1 text-xs text-muted-foreground">
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
              ringing={meetingQuery.data?.instant ?? false}
              onPeerTimeout={() => setPeerTimedOut(true)}
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
            ) : peerDeclined ? (
              <StageMessage
                tone="info"
                title={t("They declined")}
                description={t(
                  "{{name}} can't talk right now. Try another match.",
                  { name: peerName },
                )}
                action={
                  <Button onClick={() => navigate("/find-conversation")}>
                    {t("Find another match")}
                  </Button>
                }
              />
            ) : peerTimedOut ? (
              <StageMessage
                tone="info"
                title={t("They didn't pick up")}
                description={t(
                  "Looks like {{name}} didn't join. They might have stepped away — try another match.",
                  { name: peerName },
                )}
                action={
                  <Button onClick={() => navigate("/find-conversation")}>
                    {t("Find another match")}
                  </Button>
                }
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
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:flex-row sm:items-center sm:justify-center sm:px-6 sm:pb-6">
      <div
        className={cn(
          "relative flex min-h-0 w-full flex-1 flex-col gap-3",
          "sm:block sm:aspect-video sm:flex-none sm:gap-0 sm:overflow-hidden sm:rounded-3xl",
          "sm:bg-linear-to-br sm:from-secondary/90 sm:via-secondary sm:to-secondary/70",
          "sm:shadow-2xl sm:shadow-primary/15 sm:ring-1 sm:ring-border/60"
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
  ringing: boolean
  onPeerTimeout: () => void
}

function VideoStage({
  peerName,
  peerInitials,
  localInitials,
  ringing,
  onPeerTimeout,
}: VideoStageProps) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false })
  const { isCameraEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const peerHasEverJoinedRef = useRef(false)
  const onTimeoutRef = useRef(onPeerTimeout)

  useEffect(() => {
    onTimeoutRef.current = onPeerTimeout
  }, [onPeerTimeout])

  useEffect(() => {
    if (remoteParticipants.length > 0) peerHasEverJoinedRef.current = true
  }, [remoteParticipants.length])

  // One-shot timer from room mount: if the peer never showed up by the
  // deadline, bubble up so the parent can tear down LiveKit and offer to
  // find another match. We only act on the "never joined" case — if they
  // joined and then left mid-call, that's a normal hangup.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!peerHasEverJoinedRef.current) onTimeoutRef.current()
    }, PEER_JOIN_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  const remoteTrack = tracks.find(
    (track) => !track.participant.isLocal && track.publication,
  )
  const localTrack = tracks.find(
    (track) => track.participant.isLocal && track.publication,
  )

  return (
    <>
      <div className={remoteTileClass}>
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
            ringing={ringing}
          />
        )}
      </div>

      <div className={localTileClass}>
        {localTrack && isCameraEnabled ? (
          <VideoTrack
            trackRef={localTrack}
            className="absolute inset-0 size-full -scale-x-100 object-cover"
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
  ringing?: boolean
}

function RemotePlaceholder({
  peerName,
  peerInitials,
  waiting,
  ringing,
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
            {ringing
              ? t("Ringing {{name}}…", { name: peerName })
              : t("Waiting for {{name}} to join…", { name: peerName })}
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
      <div className={remoteTileClass}>
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
      </div>

      <div className={localTileClass}>
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
      <p className="max-w-md text-xs text-secondary-foreground/70">
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

// The two video feeds adapt to the viewport. On phones/portrait they stack as
// equal tiles that fill the available vertical space (no overlap). On sm+ the
// remote feed fills the immersive 16:9 stage and the local feed becomes the
// small picture-in-picture in the bottom-right corner.
const remoteTileClass = cn(
  "relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-secondary",
  "sm:absolute sm:inset-0 sm:flex-none sm:rounded-none sm:bg-transparent"
)

const localTileClass = cn(
  "relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-secondary",
  "shadow-lg shadow-primary/20",
  "sm:absolute sm:right-4 sm:bottom-4 sm:aspect-video sm:w-1/4 sm:max-w-55 sm:min-w-35",
  "sm:flex-none sm:rounded-xl sm:ring-2 sm:ring-background/80"
)

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

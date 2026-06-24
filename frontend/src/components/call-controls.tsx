import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  MicIcon,
  MicOffIcon,
  SparklesIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react"
import { TrackToggle, useLocalParticipant } from "@livekit/components-react"
import { LocalParticipant, LocalVideoTrack, Track } from "livekit-client"
import { BackgroundBlur } from "@livekit/track-processors"
import { cn } from "@/lib/utils"

const controlButtonClass = cn(
  "inline-flex size-12 items-center justify-center rounded-full",
  "bg-secondary text-secondary-foreground transition-colors",
  "ring-1 ring-border/60 hover:bg-secondary/80",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
)

// When a track is off we flip the whole button to the destructive color so the
// muted state reads at a glance (mirrors the convention in Zoom/Meet).
const controlButtonOffClass = cn(
  "bg-destructive text-destructive-foreground ring-destructive/60",
  "hover:bg-destructive/90",
)

interface CallControlToggleProps {
  source: Track.Source.Microphone | Track.Source.Camera
  enabled: boolean
  name: string
  stateLabel: string
  icon: ReactNode
}

// A single mic/camera control. The icon, color, and text label are all driven
// off the live `enabled` state (from useLocalParticipant) rather than CSS data
// attributes, so the muted/unmuted state is always reflected. TrackToggle still
// performs the actual enable/disable + permission handling.
export function CallControlToggle({
  source,
  enabled,
  name,
  stateLabel,
  icon,
}: CallControlToggleProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <TrackToggle
        source={source}
        showIcon={false}
        aria-label={name}
        className={cn(controlButtonClass, !enabled && controlButtonOffClass)}
      >
        {icon}
      </TrackToggle>
      <span
        className={cn(
          "text-[0.625rem] font-medium tracking-wide uppercase",
          enabled ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {stateLabel}
      </span>
    </div>
  )
}

// The live mic + camera controls, shown in the call footer once the room is
// connected. Reads the actual published-track state so each button shows
// whether it's currently on or off.
export function CallControls(): ReactNode {
  const { t } = useTranslation()
  const {
    isMicrophoneEnabled: micOn,
    isCameraEnabled: camOn,
    localParticipant,
  } = useLocalParticipant()

  return (
    <>
      <CallControlToggle
        source={Track.Source.Microphone}
        enabled={micOn}
        name={t("Microphone")}
        stateLabel={micOn ? t("Mic on") : t("Mic off")}
        icon={
          micOn ? (
            <MicIcon className="size-5" />
          ) : (
            <MicOffIcon className="size-5" />
          )
        }
      />
      <CallControlToggle
        source={Track.Source.Camera}
        enabled={camOn}
        name={t("Camera")}
        stateLabel={camOn ? t("Camera on") : t("Camera off")}
        icon={
          camOn ? (
            <VideoIcon className="size-5" />
          ) : (
            <VideoOffIcon className="size-5" />
          )
        }
      />
      <BackgroundBlurToggle
        localParticipant={localParticipant}
        cameraEnabled={camOn}
      />
    </>
  )
}

const BLUR_RADIUS = 10

interface BackgroundBlurToggleProps {
  localParticipant: LocalParticipant
  cameraEnabled: boolean
}

// Toggles a MediaPipe-backed background blur on the local camera track via
// LiveKit's track processors. Best-effort: applying the processor can fail
// (unsupported browser, model failed to load) — if it does we surface a toast
// and leave the call untouched rather than letting it break the call.
function BackgroundBlurToggle({
  localParticipant,
  cameraEnabled,
}: BackgroundBlurToggleProps): ReactNode {
  const { t } = useTranslation()
  const cameraTrack = localParticipant.getTrackPublication(
    Track.Source.Camera,
  )?.track
  const videoTrack =
    cameraTrack instanceof LocalVideoTrack ? cameraTrack : null
  const [blurOn, setBlurOn] = useState(false)
  const [pending, setPending] = useState(false)

  // Toggling the camera off then on publishes a fresh track with no processor,
  // so sync the button to the actual track state instead of trusting stale
  // local state (which would otherwise show "Blur on" over an un-blurred feed).
  useEffect(() => {
    setBlurOn(videoTrack ? Boolean(videoTrack.getProcessor()) : false)
  }, [videoTrack])

  async function toggleBlur(): Promise<void> {
    if (!videoTrack) return
    setPending(true)
    try {
      if (blurOn) {
        await videoTrack.stopProcessor()
        setBlurOn(false)
      } else {
        await videoTrack.setProcessor(BackgroundBlur(BLUR_RADIUS))
        setBlurOn(true)
      }
    } catch {
      toast.error(t("Couldn't change the background blur."))
    } finally {
      setPending(false)
    }
  }

  const disabled = !cameraEnabled || pending

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={toggleBlur}
        disabled={disabled}
        aria-label={t("Background blur")}
        aria-pressed={blurOn}
        className={cn(
          controlButtonClass,
          blurOn &&
            "bg-primary text-primary-foreground ring-primary/60 hover:bg-primary/90",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <SparklesIcon className="size-5" />
      </button>
      <span
        className={cn(
          "text-[0.625rem] font-medium tracking-wide uppercase",
          blurOn ? "text-primary" : "text-muted-foreground",
        )}
      >
        {blurOn ? t("Blur on") : t("Blur off")}
      </span>
    </div>
  )
}

interface DisabledControlProps {
  ariaLabel: string
  stateLabel: string
  children: ReactNode
}

function DisabledControl({
  ariaLabel,
  stateLabel,
  children,
}: DisabledControlProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled
        aria-label={ariaLabel}
        className={cn(controlButtonClass, "cursor-not-allowed opacity-50")}
      >
        {children}
      </button>
      <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground/50 uppercase">
        {stateLabel}
      </span>
    </div>
  )
}

// Placeholder controls shown before the room connects — non-interactive, with
// the same column + label shape as the live controls so the footer doesn't
// shift when the call goes live.
export function DisabledCallControls(): ReactNode {
  const { t } = useTranslation()
  return (
    <>
      <DisabledControl ariaLabel={t("Microphone")} stateLabel={t("Microphone")}>
        <MicIcon className="size-5" />
      </DisabledControl>
      <DisabledControl ariaLabel={t("Camera")} stateLabel={t("Camera")}>
        <VideoIcon className="size-5" />
      </DisabledControl>
    </>
  )
}

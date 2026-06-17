import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { PhoneIcon, PhoneOffIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCallSocket } from "@/hooks/use-call-socket"
import { declineCallApi } from "@/lib/calls"

function firstInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}

// Global incoming-call ring. Mounted once above the router so it can appear
// over any authenticated page. Driven entirely by the socket provider's
// incomingCall state.
export function IncomingCallDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { incomingCall, clearIncomingCall } = useCallSocket()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Don't ring over an active call — if they're already on a call page, suppress.
  const onCallPage = location.pathname.startsWith("/call/")
  const open = Boolean(incomingCall) && !onCallPage

  const decline = useMutation({
    mutationFn: declineCallApi,
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : t("Couldn't decline the call."),
      )
    },
  })

  // Loop the ringtone while the dialog is open. play() may be rejected by the
  // browser's autoplay policy if the user hasn't interacted yet — that's a
  // non-fatal degradation (the dialog still shows).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (open) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
    return () => audio.pause()
  }, [open])

  function handleAccept() {
    if (!incomingCall) return
    const { meetingId } = incomingCall
    clearIncomingCall()
    navigate(`/call/${meetingId}`)
  }

  function handleDecline() {
    if (!incomingCall) return
    decline.mutate(incomingCall.meetingId)
    clearIncomingCall()
  }

  const callerName = incomingCall?.caller.firstName || t("Someone")

  return (
    <>
      <audio ref={audioRef} src="/ring.wav" loop preload="auto" />
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="text-xl">
                  {firstInitial(callerName)}
                </AvatarFallback>
              </Avatar>
              <DialogTitle>
                {t("{{name}} is calling…", { name: callerName })}
              </DialogTitle>
              <DialogDescription>
                {t("They'd like to talk right now.")}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={handleDecline}>
              <PhoneOffIcon /> {t("Decline")}
            </Button>
            <Button onClick={handleAccept}>
              <PhoneIcon /> {t("Accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

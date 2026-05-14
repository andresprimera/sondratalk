import { useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircleIcon, CalendarIcon } from "lucide-react"
import type { MeetingWithPeer } from "@base-dashboard/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SectionHeader } from "@/components/section-header"
import { cancelMeetingApi, fetchUpcomingMeetingsApi } from "@/lib/meetings"
import i18n from "@/lib/i18n"

const JOIN_WINDOW_BEFORE_MS = 5 * 60 * 1000
const JOIN_WINDOW_AFTER_MS = 60 * 60 * 1000

function describeWhen(scheduledAt: Date, now: Date, t: (k: string, v?: Record<string, unknown>) => string): string {
  const diffMs = scheduledAt.getTime() - now.getTime()
  if (diffMs <= 60 * 1000 && diffMs >= -JOIN_WINDOW_AFTER_MS) {
    return t("Now")
  }
  if (diffMs > 60 * 1000 && diffMs < 60 * 60 * 1000) {
    const minutes = Math.round(diffMs / (60 * 1000))
    return t("In {{minutes}} minutes", { minutes })
  }
  return scheduledAt.toLocaleString(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function canJoin(scheduledAt: Date, now: Date): boolean {
  const diff = scheduledAt.getTime() - now.getTime()
  return diff <= JOIN_WINDOW_BEFORE_MS && diff >= -JOIN_WINDOW_AFTER_MS
}

export function UpcomingConversations() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingCancel, setPendingCancel] = useState<MeetingWithPeer | null>(
    null,
  )

  const upcomingQuery = useQuery({
    queryKey: ["meetings", "upcoming"] as const,
    queryFn: fetchUpcomingMeetingsApi,
  })

  const cancelMutation = useMutation({
    mutationFn: cancelMeetingApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
      toast.success(t("Meeting cancelled."))
      setPendingCancel(null)
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : t("Something went wrong")
      toast.error(message)
    },
  })

  return (
    <section>
      <SectionHeader title={t("Upcoming conversations")} />
      <UpcomingBody
        isLoading={upcomingQuery.isLoading}
        isError={upcomingQuery.isError}
        meetings={upcomingQuery.data?.meetings ?? []}
        onRetry={() => upcomingQuery.refetch()}
        onJoin={(m) => navigate(`/call/${m.id}`)}
        onAskCancel={setPendingCancel}
      />
      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Cancel this meeting?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("They won't be able to join after this.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep it")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (pendingCancel) cancelMutation.mutate(pendingCancel.id)
              }}
            >
              {t("Confirm cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

interface UpcomingBodyProps {
  isLoading: boolean
  isError: boolean
  meetings: MeetingWithPeer[]
  onRetry: () => void
  onJoin: (m: MeetingWithPeer) => void
  onAskCancel: (m: MeetingWithPeer) => void
}

function UpcomingBody({
  isLoading,
  isError,
  meetings,
  onRetry,
  onJoin,
  onAskCancel,
}: UpcomingBodyProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <AlertCircleIcon className="size-4 text-destructive" />
        <span>{t("Failed to load upcoming conversations.")}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("Try again")}
        </Button>
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarIcon className="size-6 text-muted-foreground/60" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t("No upcoming conversations.")}
          </p>
        </CardContent>
      </Card>
    )
  }

  const now = new Date()
  return (
    <div className="flex flex-col gap-3">
      {meetings.map((m) => (
        <MeetingRow
          key={m.id}
          meeting={m}
          now={now}
          onJoin={() => onJoin(m)}
          onAskCancel={() => onAskCancel(m)}
        />
      ))}
    </div>
  )
}

interface MeetingRowProps {
  meeting: MeetingWithPeer
  now: Date
  onJoin: () => void
  onAskCancel: () => void
}

function MeetingRow({ meeting, now, onJoin, onAskCancel }: MeetingRowProps) {
  const { t } = useTranslation()
  const scheduledAt = new Date(meeting.scheduledAt)
  const joinable = canJoin(scheduledAt, now)
  const when = describeWhen(scheduledAt, now, t)
  const displayName = meeting.peer.firstName || t("Your match")

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h6>{displayName}</h6>
            {meeting.instant && joinable && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                {t("Now")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{when}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAskCancel}>
            {t("Cancel meeting")}
          </Button>
          <Button size="sm" disabled={!joinable} onClick={onJoin}>
            {t("Join")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

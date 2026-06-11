import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CalendarClock,
  Check,
  ChevronLeft,
  X,
} from "lucide-react"
import type { SchedulingMessage } from "@base-dashboard/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import {
  fetchSchedulingThreadApi,
  proposeTimeApi,
  respondToProposalApi,
} from "@/lib/scheduling"
import i18n from "@/lib/i18n"
import { cn } from "@/lib/utils"

// The composer is intentionally option-only — users pick a day + time from
// chips, never free text. These are the candidate times we offer.
const TIME_OPTIONS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
]

interface DayOption {
  date: Date
  relativeKey: string
}

function buildDayOptions(): DayOption[] {
  const out: DayOption[] = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(base)
    date.setDate(date.getDate() + i)
    out.push({
      date,
      relativeKey: i === 0 ? "Today" : i === 1 ? "Tomorrow" : "",
    })
  }
  return out
}

function combine(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function ConversationSchedulingPage() {
  const { t } = useTranslation()
  const { meetingId = "" } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const threadQuery = useQuery({
    queryKey: ["meetings", meetingId, "scheduling"] as const,
    queryFn: () => fetchSchedulingThreadApi(meetingId),
    enabled: meetingId !== "",
  })

  const proposeMutation = useMutation({
    mutationFn: (proposedAt: string) => proposeTimeApi(meetingId, { proposedAt }),
    onSuccess: (data) => {
      queryClient.setQueryData(["meetings", meetingId, "scheduling"], data)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("Something went wrong"))
    },
  })

  const respondMutation = useMutation({
    mutationFn: (vars: { replyToId: string; accept: boolean }) =>
      respondToProposalApi(meetingId, vars),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(["meetings", meetingId, "scheduling"], data)
      if (vars.accept) {
        // The meeting moved to the agreed time — refresh the dashboard's
        // upcoming list too.
        queryClient.invalidateQueries({ queryKey: ["meetings", "upcoming"] })
        toast.success(t("Time confirmed — you're all set."))
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("Something went wrong"))
    },
  })

  const messages = threadQuery.data?.messages ?? []
  const scheduledAt = threadQuery.data?.scheduledAt
  const peerName = threadQuery.data?.peer.firstName || t("your match")
  const myId = user?.id

  return (
    <div className="mx-auto w-full max-w-3xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2"
        render={<Link to="/dashboard" />}
      >
        <ChevronLeft /> {t("Dashboard")}
      </Button>

      <div className="mb-2 text-[0.6875rem] tracking-widest text-primary/80 uppercase">
        {t("Coordinate a time")}
      </div>
      <h1 className="mb-2">{t("Find a time with {{name}}", { name: peerName })}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t(
          "No back-and-forth typing — propose a time and they answer yes or no.",
        )}
      </p>

      {threadQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-2/3 rounded-lg" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-lg" />
        </div>
      ) : threadQuery.isError ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AlertCircleIcon className="size-4 text-destructive" />
          <span>{t("Failed to load the scheduling thread.")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => threadQuery.refetch()}
          >
            {t("Try again")}
          </Button>
        </div>
      ) : (
        <>
          {scheduledAt && (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3">
                <CalendarClock className="size-5 text-primary" aria-hidden />
                <div>
                  <div className="text-[0.6875rem] tracking-widest text-muted-foreground/70 uppercase">
                    {t("Currently scheduled for")}
                  </div>
                  <div className="text-sm text-foreground">
                    {formatDateTime(scheduledAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {messages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarClock
                  className="size-6 text-muted-foreground/60"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  {t("No times proposed yet — suggest one below.")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <ThreadMessage
                  key={m.id}
                  message={m}
                  mine={m.senderId === myId}
                  peerName={peerName}
                  isConfirmed={
                    m.kind === "time_proposal" && m.proposedAt === scheduledAt
                  }
                  answered={hasMyResponse(messages, m.id, myId)}
                  onRespond={(accept) =>
                    respondMutation.mutate({ replyToId: m.id, accept })
                  }
                  responding={respondMutation.isPending}
                />
              ))}
            </div>
          )}

          <Separator className="my-8" />

          <TimeProposalComposer
            onPropose={(date) => proposeMutation.mutate(date.toISOString())}
            proposing={proposeMutation.isPending}
          />
        </>
      )}
    </div>
  )
}

function hasMyResponse(
  messages: SchedulingMessage[],
  proposalId: string,
  myId: string | undefined,
): boolean {
  return messages.some(
    (m) =>
      m.kind === "proposal_response" &&
      m.replyToId === proposalId &&
      m.senderId === myId,
  )
}

interface ThreadMessageProps {
  message: SchedulingMessage
  mine: boolean
  peerName: string
  isConfirmed: boolean
  answered: boolean
  onRespond: (accept: boolean) => void
  responding: boolean
}

function ThreadMessage({
  message,
  mine,
  peerName,
  isConfirmed,
  answered,
  onRespond,
  responding,
}: ThreadMessageProps) {
  const { t } = useTranslation()

  if (message.kind === "proposal_response") {
    const label = message.accept ? t("Yes") : t("No")
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
            message.accept
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {message.accept ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <X className="size-3.5" aria-hidden />
          )}
          {label}
        </div>
      </div>
    )
  }

  const proposedLabel = message.proposedAt
    ? `${formatDateTime(message.proposedAt)}?`
    : ""

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[85%] flex-col gap-2">
        <div
          className={cn(
            "rounded-lg px-4 py-2.5",
            mine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <div
            className={cn(
              "mb-0.5 text-[0.6875rem] tracking-wide uppercase",
              mine ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {mine ? t("You proposed") : t("{{name}} proposed", { name: peerName })}
          </div>
          <div className="text-sm font-medium">{proposedLabel}</div>
        </div>

        {isConfirmed && (
          <Badge
            variant="outline"
            className="w-fit border-primary/40 text-primary"
          >
            <Check className="size-3" /> {t("Confirmed")}
          </Badge>
        )}

        {!mine && !answered && !isConfirmed && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={responding}
              onClick={() => onRespond(true)}
            >
              <Check /> {t("Yes")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={responding}
              onClick={() => onRespond(false)}
            >
              <X /> {t("No")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface TimeProposalComposerProps {
  onPropose: (date: Date) => void
  proposing: boolean
}

function TimeProposalComposer({
  onPropose,
  proposing,
}: TimeProposalComposerProps) {
  const { t } = useTranslation()
  const days = useMemo(() => buildDayOptions(), [])
  const [dayIndex, setDayIndex] = useState(0)
  const [time, setTime] = useState<string | null>(null)

  const selectedDay = days[dayIndex]
  const now = new Date()
  const times = TIME_OPTIONS.filter(
    (opt) => combine(selectedDay.date, opt).getTime() > now.getTime(),
  )

  const proposedDate = time ? combine(selectedDay.date, time) : null

  return (
    <div>
      <h6 className="mb-1">{t("Propose a time")}</h6>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("Pick a day and a time to suggest.")}
      </p>

      <div className="mb-2 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
        {t("Day")}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {days.map((d, i) => {
          const label = d.relativeKey
            ? t(d.relativeKey)
            : d.date.toLocaleDateString(i18n.language, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })
          const on = i === dayIndex
          return (
            <button
              key={d.date.toISOString()}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setDayIndex(i)
                setTime(null)
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="mb-2 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
        {t("Time")}
      </div>
      {times.length === 0 ? (
        <p className="mb-5 text-sm text-muted-foreground/60">
          {t("No more times today — pick another day.")}
        </p>
      ) : (
        <div className="mb-5 flex flex-wrap gap-2">
          {times.map((opt) => {
            const on = opt === time
            return (
              <button
                key={opt}
                type="button"
                aria-pressed={on}
                onClick={() => setTime(opt)}
                className={cn(
                  "rounded-md border px-3 py-1 text-sm transition-colors",
                  on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
                )}
              >
                {formatTime(combine(selectedDay.date, opt))}
              </button>
            )
          })}
        </div>
      )}

      <Button
        disabled={!proposedDate || proposing}
        onClick={() => {
          if (proposedDate) onPropose(proposedDate)
          setTime(null)
        }}
      >
        {proposing ? t("Proposing…") : t("Propose this time")}
      </Button>
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircleIcon, ArrowRight, ChevronLeft } from "lucide-react"
import type { Circle, MatchCandidate } from "@base-dashboard/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useFindTalkMatch } from "@/hooks/use-find-talk-match"
import { fetchMyCirclesApi } from "@/lib/memberships"
import { createMeetingApi } from "@/lib/meetings"
import { ApiError } from "@/lib/api-error"
import i18n from "@/lib/i18n"
import { cn } from "@/lib/utils"

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

function isRealObjectId(id: string | number): id is string {
  return typeof id === "string" && OBJECT_ID_REGEX.test(id)
}

type Stage = "request" | "searching" | "matches"
type Intent = "specific" | "talk" | "heard"

interface SlotTime {
  time: string // wall-clock HH:mm in requester's tz, for display
  startsAt: string // UTC ISO instant of the slot — the source of truth for booking
}

interface SlotDay {
  dayKey: string // translation key: "Today", "Tomorrow", or "" (no relative prefix)
  date: Date
  times: SlotTime[]
}

interface CardMatch {
  id: string | number
  available: boolean
  circles?: string[]
  name?: string
  slots?: SlotDay[]
}

interface SelectedSlot {
  matchId: string | number
  dayKey: string
  date: Date
  time: string
  startsAt: string
}

function todayInRequesterTz(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function relativeDayKey(requesterDate: string, todayYmd: string): string {
  if (requesterDate === todayYmd) return "Today"
  const today = new Date(`${todayYmd}T00:00:00`)
  const target = new Date(`${requesterDate}T00:00:00`)
  const offsetDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  )
  if (offsetDays === 1) return "Tomorrow"
  return ""
}

function groupSlotsByDate(
  slots: { startsAt: string; requesterDate: string; requesterTime: string }[],
): SlotDay[] {
  const todayYmd = todayInRequesterTz()
  const byDate = new Map<string, SlotTime[]>()
  for (const s of slots) {
    const list = byDate.get(s.requesterDate) ?? []
    list.push({ time: s.requesterTime, startsAt: s.startsAt })
    byDate.set(s.requesterDate, list)
  }
  const out: SlotDay[] = []
  for (const [date, times] of byDate) {
    out.push({
      dayKey: relativeDayKey(date, todayYmd),
      date: new Date(`${date}T00:00:00`),
      times,
    })
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

function realTalkToCardMatch(
  candidate: MatchCandidate,
  locale: "en" | "es",
): CardMatch {
  return {
    id: candidate.id,
    available: candidate.availableNow,
    name: candidate.firstName,
    circles: candidate.sharedCircles.map((c) => c.labels[locale]),
    slots: candidate.availableNow ? undefined : groupSlotsByDate(candidate.slots),
  }
}

export default function FindConversationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const isTalkNow = searchParams.get("mode") === "talknow"
  const myCirclesQuery = useQuery({
    queryKey: ["users", "me", "circles"] as const,
    queryFn: fetchMyCirclesApi,
  })
  const talkMatch = useFindTalkMatch()
  const createMeeting = useMutation({
    mutationFn: createMeetingApi,
    onSuccess: (_meeting, variables) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
      // Backend marks the initiator available on instant calls — refresh
      // local cache so the dashboard's online pill reflects it.
      if (variables.instant) {
        queryClient.invalidateQueries({ queryKey: ["users", "me", "availability"] })
      }
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : t("Couldn't start the call.")
      toast.error(message)
    },
  })

  const [stage, setStage] = useState<Stage>("request")
  const [offCircleIds, setOffCircleIds] = useState<Set<string>>(new Set())
  const [intent, setIntent] = useState<Intent | null>(isTalkNow ? "talk" : null)
  const autoStarted = useRef(false)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)

  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return t("Good morning")
    if (hour < 18) return t("Good afternoon")
    return t("Good evening")
  })()

  const talkMutate = talkMatch.mutate
  useEffect(() => {
    if (!isTalkNow || autoStarted.current || myCirclesQuery.isLoading || stage !== "request") return
    const circleIds = (myCirclesQuery.data ?? []).map((c) => c.id)
    if (circleIds.length === 0) return
    autoStarted.current = true
    setStage("searching")
    talkMutate(
      { circleIds },
      {
        onSettled: () => setStage("matches"),
        onError: (err) => {
          const isNotFound = err instanceof ApiError && err.statusCode === 404
          if (!isNotFound) {
            toast.error(err instanceof Error ? err.message : t("Something went wrong"))
          }
        },
      },
    )
  }, [isTalkNow, myCirclesQuery.isLoading, myCirclesQuery.data, stage, talkMutate, t])

  const circles = myCirclesQuery.data ?? []
  const activeCircleIds = circles
    .filter((c) => !offCircleIds.has(c.id))
    .map((c) => c.id)
  const hasNoCircles = !myCirclesQuery.isLoading && circles.length === 0
  const findDisabled =
    activeCircleIds.length === 0 && (intent === "talk" || intent === null)

  function toggleCircle(id: string) {
    setOffCircleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startSearch() {
    const resolved: Intent = intent ?? "talk"
    setIntent(resolved)
    setSelectedSlot(null)

    if (resolved === "specific" || resolved === "heard") {
      toast.info(t("Not available in Beta yet."))
      return
    }

    if (activeCircleIds.length === 0) {
      toast.error(t("Pick at least one circle"))
      return
    }
    setStage("searching")
    talkMatch.mutate(
      { circleIds: activeCircleIds },
      {
        onSettled: () => setStage("matches"),
        onError: (err) => {
          const isNotFound =
            err instanceof ApiError && err.statusCode === 404
          if (!isNotFound) {
            const message =
              err instanceof Error ? err.message : t("Something went wrong")
            toast.error(message)
          }
        },
      },
    )
  }

  function reset() {
    setStage("request")
    setSelectedSlot(null)
    talkMatch.reset()
  }

  function confirmSelectedSlot() {
    if (!selectedSlot) return
    const match = cardMatches.find((m) => m.id === selectedSlot.matchId)
    const name = match?.name ?? t("them")
    if (!isRealObjectId(selectedSlot.matchId)) {
      toast.success(
        t("We'll let {{name}} know — you'll see it in your dashboard.", {
          name,
        }),
      )
      navigate("/dashboard")
      return
    }
    createMeeting.mutate(
      { peerUserId: selectedSlot.matchId, scheduledAt: selectedSlot.startsAt },
      {
        onSuccess: () => {
          toast.success(
            t("We'll let {{name}} know — you'll see it in your dashboard.", {
              name,
            }),
          )
          navigate("/dashboard")
        },
      },
    )
  }

  if (stage === "searching") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 text-base text-foreground">
          {t("Looking for someone to talk to…")}
        </p>
        <p className="mb-8 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
          {t("Matching on your active circles")}
        </p>
        <div className="flex gap-2" aria-hidden>
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    )
  }

  const cardMatches: CardMatch[] =
    stage === "matches"
      ? (talkMatch.data?.candidates ?? []).map((c) =>
          realTalkToCardMatch(c, locale),
        )
      : []

  if (stage === "matches") {
    const noMatch =
      talkMatch.isError &&
      talkMatch.error instanceof ApiError &&
      talkMatch.error.statusCode === 404

    const eyebrow =
      cardMatches.length === 1
        ? t("We found a match")
        : t("We found {{count}} good matches", { count: cardMatches.length })

    const sub =
      cardMatches.length > 1
        ? t("Pick whoever works for you — now or at a time that fits.")
        : t("Available to talk, right now or later.")

    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2"
          onClick={reset}
        >
          <ChevronLeft /> {t("Refine request")}
        </Button>

        {noMatch ? (
          <NoMatchState
            onRetry={() => {
              if (activeCircleIds.length === 0) return
              setStage("searching")
              talkMatch.mutate(
                { circleIds: activeCircleIds },
                { onSettled: () => setStage("matches") },
              )
            }}
            onRefine={reset}
          />
        ) : (
          <>
            <div className="mb-2 text-[0.6875rem] tracking-widest text-primary/80 uppercase">
              {eyebrow}
            </div>
            <h1 className="mb-2">{t("Someone is waiting.")}</h1>
            <p className="mb-8 text-sm text-muted-foreground">{sub}</p>

            <div className="flex flex-col gap-4">
              {cardMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  locale={locale}
                  selectedSlot={
                    selectedSlot?.matchId === m.id ? selectedSlot : null
                  }
                  onSelectSlot={setSelectedSlot}
                  onTalkNow={() => {
                    if (!isRealObjectId(m.id)) return
                    createMeeting.mutate(
                      { peerUserId: m.id, instant: true },
                      {
                        onSuccess: (meeting) =>
                          navigate(`/call/${meeting.id}`),
                      },
                    )
                  }}
                  talkNowDisabled={!isRealObjectId(m.id) || createMeeting.isPending}
                />
              ))}
            </div>

            {selectedSlot && (
              <Card className="mt-6">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const match = cardMatches.find(
                        (c) => c.id === selectedSlot.matchId,
                      )
                      const dayLabel = selectedSlot.date.toLocaleDateString(
                        i18n.language,
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        },
                      )
                      const day = selectedSlot.dayKey
                        ? `${t(selectedSlot.dayKey)} · ${dayLabel}`
                        : dayLabel
                      return t(
                        "Scheduling with {{name}} — {{day}} at {{time}}",
                        {
                          name: match?.name ?? `#${selectedSlot.matchId}`,
                          day,
                          time: selectedSlot.time,
                        },
                      )
                    })()}
                  </p>
                  <Button onClick={confirmSelectedSlot}>
                    {t("Confirm")} <ArrowRight />
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    )
  }

  // stage === "request"
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2"
        render={<Link to="/dashboard" />}
      >
        <ChevronLeft /> {t("Dashboard")}
      </Button>

      <p className="mb-8 text-sm text-muted-foreground">
        {greeting}, {user?.name}.
      </p>

      <div className="mb-3 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
        {t("Showing up as")}
      </div>
      {myCirclesQuery.isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      ) : myCirclesQuery.isError ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AlertCircleIcon className="size-4 text-destructive" />
          <span>{t("Failed to load circles.")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => myCirclesQuery.refetch()}
          >
            {t("Try again")}
          </Button>
        </div>
      ) : circles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("You haven't picked any circles yet.")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {circles.map((c) => {
            const on = !offCircleIds.has(c.id)
            return (
              <CircleToggle
                key={c.id}
                circle={c}
                locale={locale}
                on={on}
                onToggle={() => toggleCircle(c.id)}
              />
            )
          })}
        </div>
      )}

      <Separator className="my-8" />

      <h6 className="mb-4">{t("Is there something specific on your mind?")}</h6>

      <div className="flex flex-col gap-2">
        <IntentChoice
          label={t("Not really — just talk")}
          selected={intent === "talk"}
          onSelect={() => setIntent("talk")}
          disabled={hasNoCircles}
          hint={
            hasNoCircles
              ? t("Add a circle so we can find you the right person.")
              : undefined
          }
          hintTo={hasNoCircles ? "/dashboard/my-circles" : undefined}
        />
        <IntentChoice
          label={t("Yes, I have something specific")}
          selected={intent === "specific"}
          onSelect={() => setIntent("specific")}
          hint={t("Not available in Beta yet.")}
        />
        <IntentChoice
          label={t("I just need to be heard")}
          selected={intent === "heard"}
          onSelect={() => setIntent("heard")}
          hint={t("Not available in Beta yet.")}
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={startSearch} disabled={findDisabled}>
          {t("Find someone")}
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

interface CircleToggleProps {
  circle: Circle
  locale: "en" | "es"
  on: boolean
  onToggle: () => void
}

function CircleToggle({ circle, locale, on, onToggle }: CircleToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {circle.labels[locale]}
    </button>
  )
}

interface IntentChoiceProps {
  label: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  hint?: string
  hintTo?: string
}

function IntentChoice({
  label,
  selected,
  onSelect,
  disabled,
  hint,
  hintTo,
}: IntentChoiceProps) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
          disabled
            ? "cursor-not-allowed border-border bg-card text-muted-foreground/40"
            : selected
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-full border transition-colors",
            selected && !disabled
              ? "border-primary bg-primary"
              : "border-muted-foreground/40",
          )}
        />
        {label}
      </button>
      {hint &&
        (hintTo ? (
          <Link
            to={hintTo}
            className="px-4 text-xs text-primary underline-offset-2 hover:underline"
          >
            {hint}
          </Link>
        ) : (
          <p className="px-4 text-xs text-muted-foreground/70">
            {hint}
          </p>
        ))}
    </div>
  )
}

interface NoMatchStateProps {
  onRetry: () => void
  onRefine: () => void
}

function NoMatchState({ onRetry, onRefine }: NoMatchStateProps) {
  const { t } = useTranslation()
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <AlertCircleIcon className="size-6 text-muted-foreground" />
        <div>
          <h6 className="mb-1">{t("No one's around right now")}</h6>
          <p className="text-sm text-muted-foreground">
            {t("Try again in a moment.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={onRetry}>{t("Try again")}</Button>
          <Button variant="outline" onClick={onRefine}>
            {t("Refine request")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface MatchCardProps {
  match: CardMatch
  locale: "en" | "es"
  selectedSlot: SelectedSlot | null
  onSelectSlot: (slot: SelectedSlot) => void
  onTalkNow?: () => void
  talkNowDisabled?: boolean
}

function MatchCard({
  match,
  locale,
  selectedSlot,
  onSelectSlot,
  onTalkNow,
  talkNowDisabled,
}: MatchCardProps) {
  const { t } = useTranslation()
  const idLabel = match.name
    ? match.name.charAt(0).toUpperCase()
    : String(match.id)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm",
              match.name
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {idLabel}
          </div>
          <div className="flex-1">
            {match.name && <h6 className="mb-1">{match.name}</h6>}
            {(match.circles ?? []).length > 0 && (
              <>
                <div className="mb-1 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
                  {t("Shared circles")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(match.circles ?? []).map((c) => (
                    <Badge key={c} variant="secondary">
                      {t(c)}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {match.available ? (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]"
                />
                <span className="text-foreground">
                  {t("Available right now")}
                </span>
              </div>
              <Button
                onClick={onTalkNow}
                disabled={!onTalkNow || talkNowDisabled}
              >
                {t("Talk Now")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Separator />
            <div>
              <div className="mb-3 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
                {t("Next available")}
              </div>
              <div className="flex flex-col gap-3">
                {(match.slots ?? []).map((day) => {
                  const dayLabel = day.date.toLocaleDateString(locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })
                  const heading = day.dayKey
                    ? `${t(day.dayKey)} · ${dayLabel}`
                    : dayLabel
                  return (
                    <div key={day.date.toISOString()}>
                      <div className="mb-1.5 text-xs text-muted-foreground">
                        {heading}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {day.times.map(({ time, startsAt }) => {
                          const isSelected =
                            selectedSlot?.matchId === match.id &&
                            selectedSlot?.startsAt === startsAt
                          return (
                            <button
                              key={startsAt}
                              type="button"
                              onClick={() =>
                                onSelectSlot({
                                  matchId: match.id,
                                  dayKey: day.dayKey,
                                  date: day.date,
                                  time,
                                  startsAt,
                                })
                              }
                              className={cn(
                                "rounded-md border px-3 py-1 text-sm transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
                              )}
                            >
                              {time}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

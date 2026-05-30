import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircleIcon, ArrowRight, ChevronLeft } from "lucide-react"
import type {
  Circle,
  HeardCandidate,
  MatchCandidate,
} from "@base-dashboard/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import {
  useFindHeardMatch,
  useFindTalkMatch,
} from "@/hooks/use-find-talk-match"
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

interface SuggestionRule {
  words: string[]
  circles: string[]
}

const SUGGESTION_RULES: SuggestionRule[] = [
  {
    words: [
      "finance",
      "money",
      "budget",
      "saving",
      "invest",
      "pension",
      "tax",
      "accounting",
      "finanza",
      "dinero",
      "ahorr",
      "inver",
      "impuesto",
    ],
    circles: ["Personal Finance", "Financial Planning", "Accountant"],
  },
  {
    words: [
      "dress",
      "outfit",
      "style",
      "fashion",
      "clothes",
      "wear",
      "gala",
      "wedding",
      "moda",
      "vestido",
      "ropa",
      "boda",
    ],
    circles: ["Fashion", "Personal Styling", "Event Planning"],
  },
  {
    words: [
      "gym",
      "fitness",
      "workout",
      "training",
      "run",
      "marathon",
      "sport",
      "deporte",
      "entrena",
      "correr",
      "marat",
    ],
    circles: ["Fitness", "Personal Training", "Health & Wellness"],
  },
  {
    words: [
      "business",
      "startup",
      "founder",
      "idea",
      "product",
      "market",
      "negocio",
      "emprendi",
      "fundador",
      "producto",
      "mercado",
    ],
    circles: ["Startup founder", "Entrepreneur", "Product"],
  },
  {
    words: [
      "relationship",
      "partner",
      "dating",
      "love",
      "marriage",
      "relación",
      "pareja",
      "amor",
      "matrimonio",
    ],
    circles: ["Life Coaching", "Relationships"],
  },
]

const FALLBACK_SUGGESTIONS = ["Active listener", "Open conversation"]

function suggestCircles(text: string): string[] {
  const lower = text.toLowerCase()
  if (!lower.trim()) return []
  for (const rule of SUGGESTION_RULES) {
    if (rule.words.some((w) => lower.includes(w))) return rule.circles
  }
  return FALLBACK_SUGGESTIONS
}

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
  isHost?: boolean
  hostExp?: number
  circles?: string[]
  name?: string
  slots?: SlotDay[]
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d
}

// Mock entries never reach the backend (see isRealObjectId guard); startsAt is
// synthesized from browser-local date + time purely so the type matches.
function mockSlotTimes(date: Date, times: string[]): SlotTime[] {
  return times.map((time) => {
    const [hh, mm] = time.split(":").map(Number)
    const d = new Date(date)
    d.setHours(hh, mm, 0, 0)
    return { time, startsAt: d.toISOString() }
  })
}

const SPECIFIC_MOCK_POOL: CardMatch[] = [
  {
    id: 1,
    available: true,
    circles: ["Personal Finance", "Financial Planning"],
  },
  {
    id: 2,
    available: false,
    circles: ["Accountant", "Tax Adviser"],
    slots: [
      {
        dayKey: "Tomorrow",
        date: daysFromNow(1),
        times: mockSlotTimes(daysFromNow(1), ["09:00", "11:30", "15:00"]),
      },
      {
        dayKey: "In a few days",
        date: daysFromNow(3),
        times: mockSlotTimes(daysFromNow(3), ["10:00", "14:30"]),
      },
    ],
  },
  { id: 3, available: true, circles: ["Financial Coach"] },
]

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

function realHeardToCardMatch(
  candidate: HeardCandidate,
  locale: "en" | "es",
): CardMatch {
  return {
    id: candidate.id,
    available: candidate.availableNow,
    name: candidate.firstName,
    isHost: true,
    hostExp: candidate.hostExp,
    circles: candidate.sharedCircles.map((c) => c.labels[locale]),
    slots: candidate.availableNow ? undefined : groupSlotsByDate(candidate.slots),
  }
}

type SimulatedMatch =
  | { intent: "talk"; data: MatchCandidate }
  | { intent: "heard"; data: HeardCandidate }

export default function FindConversationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const myCirclesQuery = useQuery({
    queryKey: ["users", "me", "circles"] as const,
    queryFn: fetchMyCirclesApi,
  })
  const talkMatch = useFindTalkMatch()
  const heardMatch = useFindHeardMatch()
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
  const [intent, setIntent] = useState<Intent | null>(null)
  const [intentText, setIntentText] = useState("")
  const [offTargetCircles, setOffTargetCircles] = useState<Set<string>>(new Set())
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [simulatedMatch, setSimulatedMatch] = useState<SimulatedMatch | null>(
    null,
  )

  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return t("Good morning")
    if (hour < 18) return t("Good afternoon")
    return t("Good evening")
  })()

  const suggestedCircles = useMemo(
    () => (intent === "specific" ? suggestCircles(intentText) : []),
    [intent, intentText],
  )
  const suggestedKey = suggestedCircles.join("|")

  useEffect(() => {
    setOffTargetCircles(new Set())
  }, [suggestedKey])

  const circles = myCirclesQuery.data ?? []
  const activeCircleIds = circles
    .filter((c) => !offCircleIds.has(c.id))
    .map((c) => c.id)
  const hasNoCircles = !myCirclesQuery.isLoading && circles.length === 0
  const findDisabled =
    activeCircleIds.length === 0 &&
    (intent === "talk" || intent === "heard" || intent === null)

  function toggleCircle(id: string) {
    setOffCircleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTargetCircle(name: string) {
    setOffTargetCircles((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function startSearch() {
    const resolved: Intent = intent ?? "talk"
    setIntent(resolved)
    setSelectedSlot(null)

    if (resolved === "talk" || resolved === "heard") {
      if (activeCircleIds.length === 0) {
        toast.error(t("Pick at least one circle"))
        return
      }
      setStage("searching")
      const mutation = resolved === "talk" ? talkMatch : heardMatch
      mutation.mutate(
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
      return
    }

    setStage("searching")
    setTimeout(() => setStage("matches"), 2200)
  }

  function reset() {
    setStage("request")
    setSelectedSlot(null)
    setSimulatedMatch(null)
    talkMatch.reset()
    heardMatch.reset()
  }

  function simulateMatch() {
    const sample = circles.slice(0, 2)
    const fallbackCircles: Circle[] = [
      {
        id: "sim-c1",
        slug: "catalan",
        themeId: "sim-t1",
        labels: { en: "Catalan", es: "Catalán" },
        aliases: { en: [], es: [] },
        popularity: 0,
      },
      {
        id: "sim-c2",
        slug: "expat",
        themeId: "sim-t2",
        labels: { en: "Expat", es: "Expat" },
        aliases: { en: [], es: [] },
        popularity: 0,
      },
    ]
    const sharedCircles = sample.length > 0 ? sample : fallbackCircles
    const resolvedIntent: Intent = intent === "heard" ? "heard" : "talk"
    const fake: SimulatedMatch =
      resolvedIntent === "heard"
        ? {
            intent: "heard",
            data: {
              id: "simulated",
              firstName: "Marta",
              hostExp: 32,
              sharedCircles,
              availableNow: true,
              slots: [],
            },
          }
        : {
            intent: "talk",
            data: {
              id: "simulated",
              firstName: "Ana",
              sharedCircles,
              availableNow: true,
              slots: [],
            },
          }
    setIntent(resolvedIntent)
    setSelectedSlot(null)
    talkMatch.reset()
    heardMatch.reset()
    setStage("searching")
    setTimeout(() => {
      setSimulatedMatch(fake)
      setStage("matches")
    }, 1600)
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
      reset()
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
          reset()
        },
      },
    )
  }

  if (stage === "searching") {
    const lineMap: Record<Intent, string> = {
      specific: t("Finding the right person for you…"),
      talk: t("Looking for someone to talk to…"),
      heard: t("Looking for an experienced listener…"),
    }
    const subMap: Record<Intent, string> = {
      specific: t("Matching on your circles and intent"),
      talk: t("Matching on your active circles"),
      heard: t("Filtering for Host Exp only"),
    }
    const resolvedIntent: Intent = intent ?? "talk"
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 text-base text-foreground italic">
          {lineMap[resolvedIntent]}
        </p>
        <p className="mb-8 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
          {subMap[resolvedIntent]}
        </p>
        <div className="flex gap-2" aria-hidden>
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    )
  }

  let cardMatches: CardMatch[] = []
  if (stage === "matches") {
    const resolvedIntent: Intent = intent ?? "talk"
    if (resolvedIntent === "talk") {
      const data =
        simulatedMatch?.intent === "talk"
          ? { candidates: [simulatedMatch.data] }
          : talkMatch.data
      cardMatches = data
        ? data.candidates.map((c) => realTalkToCardMatch(c, locale))
        : []
    } else if (resolvedIntent === "heard") {
      const data =
        simulatedMatch?.intent === "heard"
          ? { candidates: [simulatedMatch.data] }
          : heardMatch.data
      cardMatches = data
        ? data.candidates.map((c) => realHeardToCardMatch(c, locale))
        : []
    } else {
      cardMatches = SPECIFIC_MOCK_POOL
    }
  }

  if (stage === "matches") {
    const resolvedIntent: Intent = intent ?? "talk"
    const activeMutation =
      resolvedIntent === "talk"
        ? talkMatch
        : resolvedIntent === "heard"
          ? heardMatch
          : null
    const noMatch =
      activeMutation !== null &&
      !simulatedMatch &&
      activeMutation.isError &&
      activeMutation.error instanceof ApiError &&
      activeMutation.error.statusCode === 404

    const headingMap: Record<Intent, string> = {
      specific: t("Here's who can help."),
      talk: t("Someone is waiting."),
      heard: t("A listener is ready."),
    }

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
              if (activeCircleIds.length === 0 || !activeMutation) return
              setStage("searching")
              activeMutation.mutate(
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
            <h1 className="mb-2">{headingMap[resolvedIntent]}</h1>
            <p className="mb-8 text-sm text-muted-foreground italic">{sub}</p>

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
                    if (!isRealObjectId(m.id)) {
                      toast.info(
                        t("This is a simulated match — start a real one."),
                      )
                      return
                    }
                    createMeeting.mutate(
                      { peerUserId: m.id, instant: true },
                      {
                        onSuccess: (meeting) =>
                          navigate(`/call/${meeting.id}`),
                      },
                    )
                  }}
                  talkNowDisabled={createMeeting.isPending}
                />
              ))}
            </div>

            {selectedSlot && (
              <Card className="mt-6">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground italic">
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
          label={t("Yes, I have something specific")}
          selected={intent === "specific"}
          onSelect={() => setIntent("specific")}
        />
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
          label={t("I just need to be heard")}
          selected={intent === "heard"}
          onSelect={() => setIntent("heard")}
          disabled={hasNoCircles}
          hint={
            hasNoCircles
              ? t("Add a circle so we can find you the right person.")
              : undefined
          }
          hintTo={hasNoCircles ? "/dashboard/my-circles" : undefined}
        />
      </div>

      {intent === "specific" && (
        <div className="mt-4">
          <Textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            placeholder={t(
              "Describe what you're looking for — the more you share, the better the match…",
            )}
            rows={3}
          />

          {suggestedCircles.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
                {t("Sondra will look for someone in")}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedCircles.map((name) => {
                  const on = !offTargetCircles.has(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleTargetCircle(name)}
                      className={cn(
                        "rounded-full border px-3 py-0.5 text-sm transition-colors",
                        on
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground/60",
                      )}
                    >
                      {t(name)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {intent === "heard" && (
        <Card className="mt-4 border-primary/30 bg-primary/5">
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              {t(
                "Sondra will match you with someone who has Host Exp — people who've shown up as listeners and advisers for others before.",
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={startSearch} disabled={findDisabled}>
          {intent === "specific"
            ? t("Find someone who can help")
            : intent === "heard"
              ? t("Find a listener")
              : t("Find someone")}
          <ArrowRight />
        </Button>
        <Button variant="ghost" size="sm" onClick={simulateMatch}>
          {t("Simulate a match (preview)")}
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
            className="px-4 text-xs text-primary italic underline-offset-2 hover:underline"
          >
            {hint}
          </Link>
        ) : (
          <p className="px-4 text-xs text-muted-foreground/70 italic">
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
          <p className="text-sm text-muted-foreground italic">
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
  const idLabel = match.isHost
    ? "✦"
    : match.name
      ? match.name.charAt(0).toUpperCase()
      : String(match.id)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm",
              match.isHost
                ? "border-primary/30 bg-primary/10 text-primary"
                : match.name
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {idLabel}
          </div>
          <div className="flex-1">
            {match.name && <h6 className="mb-1">{match.name}</h6>}
            {match.isHost && (
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary"
                >
                  ✦ {t("Host")}
                </Badge>
                <span className="text-xs text-muted-foreground italic">
                  {t("{{count}} conversations as listener or adviser", {
                    count: match.hostExp ?? 0,
                  })}
                </span>
              </div>
            )}
            {(match.circles ?? []).length > 0 && (
              <>
                <div className="mb-1 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
                  {match.name
                    ? t("Shared circles")
                    : t("Can help with")}
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

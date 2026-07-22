import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchAllCirclesApi } from "@/lib/circles"
import { CirclePasswordDialog } from "@/components/circle-password-dialog"
import type { Circle, CircleType } from "@base-dashboard/shared"

export interface OnboardingCircle {
  id: string
  label: string
}

interface OnboardingCirclesStepProps {
  circles: OnboardingCircle[]
  onCirclesChange: (next: OnboardingCircle[]) => void
  onSubmit: () => void
  isSubmitting: boolean
  onBack: () => void
}

const INITIAL_SHOW = 9

function CircleGroup({
  label,
  circles: groupCircles,
  selected,
  locale,
  onAdd,
}: {
  label: string
  circles: Circle[]
  selected: OnboardingCircle[]
  locale: "en" | "es"
  onAdd: (c: Circle) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? groupCircles : groupCircles.slice(0, INITIAL_SHOW)
  const remaining = groupCircles.length - INITIAL_SHOW

  if (groupCircles.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="onboarding-section-label">{label}</span>
        <div className="h-px flex-1 bg-border/20" aria-hidden />
      </div>
      <div className="onboarding-chip-row">
        {visible.map((c) => {
          const displayLabel = c.labels[locale]
          const used = selected.some((s) => s.id === c.id)
          return (
            <button
              key={c.id}
              type="button"
              className="onboarding-chip"
              data-used={used}
              onClick={() => onAdd(c)}
              aria-pressed={used}
            >
              {displayLabel}
            </button>
          )
        })}
      </div>
      {groupCircles.length > INITIAL_SHOW && (
        <button
          type="button"
          className="onboarding-show-more-btn mt-3"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t("← fewer")
            : t("{{n}} more →", { n: remaining })}
        </button>
      )}
    </div>
  )
}

function CircleGroupSkeleton() {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="h-px flex-1 bg-border/20" aria-hidden />
      </div>
      <div className="onboarding-chip-row">
        {Array.from({ length: INITIAL_SHOW }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
    </div>
  )
}

// Section heading per circle type. Order here is the order shown on screen.
const GROUP_LABELS: { type: CircleType; label: string }[] = [
  { type: "who-you-are", label: "Who you are" },
  { type: "what-you-love", label: "What you love" },
  { type: "where-you-are", label: "Where you are right now" },
]

export function OnboardingCirclesStep({
  circles,
  onCirclesChange,
  onSubmit,
  isSubmitting,
  onBack,
}: OnboardingCirclesStepProps) {
  const { t, i18n } = useTranslation()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"
  const [pendingPrivateCircle, setPendingPrivateCircle] =
    useState<Circle | null>(null)

  const circlesQuery = useQuery({
    queryKey: ["circles", "all"] as const,
    queryFn: fetchAllCirclesApi,
  })

  const groups = useMemo(() => {
    const all = circlesQuery.data ?? []
    return GROUP_LABELS.map((g) => ({
      ...g,
      circles: all.filter((c) => c.type === g.type),
    }))
  }, [circlesQuery.data])

  function add(circle: OnboardingCircle) {
    if (circles.some((c) => c.id === circle.id)) return
    onCirclesChange([...circles, circle])
  }

  function attemptAdd(circle: Circle) {
    if (circles.some((c) => c.id === circle.id)) return
    if (circle.isPrivate) {
      setPendingPrivateCircle(circle)
      return
    }
    add({ id: circle.id, label: circle.labels[locale] })
  }

  function remove(id: string) {
    onCirclesChange(circles.filter((c) => c.id !== id))
  }

  const hintText =
    circles.length === 0
      ? t("Add at least 3 to continue")
      : circles.length === 1
        ? t("Two more to go")
        : circles.length === 2
          ? t("One more to go")
          : " "

  return (
    <section className="mt-12">
      <button type="button" className="onboarding-back mb-8" onClick={onBack}>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t("Back")}
        </span>
      </button>
      <p className="onboarding-eyebrow mb-6">
        {t("Step {{current}} of {{total}}", { current: 3, total: 4 })}
      </p>
      <h1 className="onboarding-step-heading mb-4">
        {t("What are your circles?")}
      </h1>
      <p className="onboarding-step-subline mb-10">
        {t(
          "Choose everything that applies to you. Before each conversation, you decide which ones are active.",
        )}
      </p>

      {circles.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {circles.map((c) => (
            <span key={c.id} className="onboarding-tag">
              {c.label}
              <button
                type="button"
                className="onboarding-tag-remove"
                onClick={() => remove(c.id)}
                aria-label={t("Remove {{circle}}", { circle: c.label })}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p
        className="mb-2 text-sm italic font-light text-muted-foreground/70 transition-opacity duration-500"
        style={{ opacity: circles.length >= 3 ? 0 : undefined }}
        aria-live="polite"
      >
        {hintText}
      </p>

      <div
        className="onboarding-reveal mb-10"
        data-visible={String(circles.length >= 3)}
        aria-hidden={circles.length < 3}
      >
        <span className="onboarding-reveal-rule" aria-hidden />
        <span>✦ {t("These are your Circles.")}</span>
        <span className="onboarding-reveal-rule" aria-hidden />
      </div>

      {circlesQuery.isLoading ? (
        <div className="flex flex-col gap-8">
          <CircleGroupSkeleton />
          <CircleGroupSkeleton />
          <CircleGroupSkeleton />
        </div>
      ) : circlesQuery.isError ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">
            {t("Failed to load circles.")}
          </p>
          <Button variant="outline" onClick={() => circlesQuery.refetch()}>
            {t("Try again")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <CircleGroup
              key={g.type}
              label={t(g.label)}
              circles={g.circles}
              selected={circles}
              locale={locale}
              onAdd={attemptAdd}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onSubmit}
          disabled={circles.length < 3 || isSubmitting}
        >
          {isSubmitting ? t("Saving...") : t("Enter Sondra →")}
        </Button>
      </div>

      <CirclePasswordDialog
        circle={
          pendingPrivateCircle
            ? {
                id: pendingPrivateCircle.id,
                label: pendingPrivateCircle.labels[locale],
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) setPendingPrivateCircle(null)
        }}
        onVerified={() => {
          if (pendingPrivateCircle) {
            add({
              id: pendingPrivateCircle.id,
              label: pendingPrivateCircle.labels[locale],
            })
          }
          setPendingPrivateCircle(null)
        }}
      />
    </section>
  )
}

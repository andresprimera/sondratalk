import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CIRCLE_CATALOG,
  type CatalogCircle,
} from "@/lib/circle-catalog"

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

const IDENTITY_CIRCLES = CIRCLE_CATALOG.filter((c) => c.type === "identity")
const INTEREST_CIRCLES = CIRCLE_CATALOG.filter((c) => c.type === "interest")
const SITUATIONAL_CIRCLES = CIRCLE_CATALOG.filter(
  (c) => c.type === "situational",
)

function CircleGroup({
  label,
  circles: groupCircles,
  selected,
  locale,
  onAdd,
}: {
  label: string
  circles: CatalogCircle[]
  selected: OnboardingCircle[]
  locale: "en" | "es"
  onAdd: (c: OnboardingCircle) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? groupCircles : groupCircles.slice(0, INITIAL_SHOW)
  const remaining = groupCircles.length - INITIAL_SHOW

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="onboarding-section-label">{label}</span>
        <div className="h-px flex-1 bg-border/20" aria-hidden />
      </div>
      <div className="onboarding-chip-row">
        {visible.map((c) => {
          const displayLabel = locale === "es" ? c.es : c.en
          const used = selected.some((s) => s.id === c.id)
          return (
            <button
              key={c.id}
              type="button"
              className="onboarding-chip"
              data-used={used}
              onClick={() => onAdd({ id: c.id, label: displayLabel })}
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
  const [customInput, setCustomInput] = useState("")

  function add(circle: OnboardingCircle) {
    if (circles.some((c) => c.id === circle.id)) return
    onCirclesChange([...circles, circle])
  }

  function remove(id: string) {
    onCirclesChange(circles.filter((c) => c.id !== id))
  }

  function addCustom() {
    const val = customInput.trim()
    if (!val) return
    const id = `custom:${val}`
    if (circles.some((c) => c.id === id)) return
    add({ id, label: val })
    setCustomInput("")
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

      <div className="flex flex-col gap-8">
        <CircleGroup
          label={t("Who you are")}
          circles={IDENTITY_CIRCLES}
          selected={circles}
          locale={locale}
          onAdd={add}
        />
        <CircleGroup
          label={t("What you love")}
          circles={INTEREST_CIRCLES}
          selected={circles}
          locale={locale}
          onAdd={add}
        />
        <CircleGroup
          label={t("Where you are right now")}
          circles={SITUATIONAL_CIRCLES}
          selected={circles}
          locale={locale}
          onAdd={add}
        />
      </div>

      <div className="mt-10 flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder={t("Add your own…")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addCustom()
            }
          }}
          className="h-11 text-base"
        />
        <button
          type="button"
          className="onboarding-add-btn"
          onClick={addCustom}
          aria-label={t("Add circle")}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

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
    </section>
  )
}

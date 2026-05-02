import { useTranslation } from "react-i18next"
import { ArrowLeft, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface OnboardingCirclesStepProps {
  circles: string[]
  onCirclesChange: (next: string[]) => void
  inputValue: string
  onInputChange: (value: string) => void
  onNext: () => void
  onBack: () => void
}

const SUGGESTED_CIRCLES = [
  "Venezuelan",
  "Catalan",
  "Peruvian",
  "Moroccan",
  "Japanese",
  "Restaurant owner",
  "Startup founder",
  "Teacher",
  "Nurse",
  "Freelancer",
  "Triathlete",
  "Salsa dancer",
  "Home cook",
  "Photographer",
  "Yoga practitioner",
  "New parent",
  "Expat",
  "PhD student",
  "Digital nomad",
  "LGBTQ+",
] as const

export function OnboardingCirclesStep({
  circles,
  onCirclesChange,
  inputValue,
  onInputChange,
  onNext,
  onBack,
}: OnboardingCirclesStepProps) {
  const { t } = useTranslation()

  function add(name: string) {
    const clean = name.trim()
    if (!clean || circles.includes(clean)) return
    onCirclesChange([...circles, clean])
  }

  function commitInput() {
    add(inputValue)
    onInputChange("")
  }

  function remove(name: string) {
    onCirclesChange(circles.filter((c) => c !== name))
  }

  const revealVisible = circles.length >= 2

  return (
    <section className="mt-12">
      <button type="button" className="onboarding-back mb-8" onClick={onBack}>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t("Back")}
        </span>
      </button>
      <p className="onboarding-eyebrow mb-6">
        {t("Step {{current}} of {{total}}", { current: 3, total: 3 })}
      </p>
      <h1 className="onboarding-step-heading mb-4">
        {t("What are you part of?")}
      </h1>
      <p className="onboarding-step-subline mb-10">
        {t(
          "The communities, backgrounds, and passions that shape you. These help Sondra find you the right person to talk to."
        )}
      </p>

      <div className="mb-6 flex items-start gap-2">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitInput()
            }
          }}
          placeholder={t("Type anything and press Enter…")}
          className="h-11 text-base"
        />
        <button
          type="button"
          className="onboarding-add-btn"
          onClick={commitInput}
          aria-label={t("Add circle")}
        >
          <Plus className="size-5" />
        </button>
      </div>

      {circles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {circles.map((c) => (
            <span key={c} className="onboarding-tag">
              {t(c)}
              <button
                type="button"
                className="onboarding-tag-remove"
                onClick={() => remove(c)}
                aria-label={t("Remove {{circle}}", { circle: t(c) })}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className="onboarding-reveal my-8"
        data-visible={revealVisible}
        aria-hidden={!revealVisible}
      >
        <span className="onboarding-reveal-rule" aria-hidden />
        <span>… {t("These are your Circles.")} </span>
        <span className="onboarding-reveal-rule" aria-hidden />
      </div>

      <p className="onboarding-section-label mb-3">{t("Some ideas")}</p>
      <div className="onboarding-chip-row mb-10">
        {SUGGESTED_CIRCLES.map((name) => {
          const used = circles.includes(name)
          return (
            <button
              key={name}
              type="button"
              className="onboarding-chip"
              data-used={used}
              onClick={() => add(name)}
              aria-pressed={used}
            >
              {t(name)}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onNext}
          disabled={circles.length === 0}
        >
          {t("Enter Sondra →")}
        </Button>
      </div>
    </section>
  )
}

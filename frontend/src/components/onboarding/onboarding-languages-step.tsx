import { useTranslation } from "react-i18next"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { getLanguageByCode } from "@/lib/languages"

export type Fluency = "Conversational" | "Fluent" | "Native"

export interface OnboardingLanguage {
  code: string
  name: string
  fluency: Fluency
}

interface OnboardingLanguagesStepProps {
  languages: OnboardingLanguage[]
  onLanguagesChange: (next: OnboardingLanguage[]) => void
  onNext: () => void
  onBack: () => void
}

const SUGGESTED_CODES = [
  "ca",
  "fr",
  "pt",
  "ar",
  "zh",
  "it",
  "de",
  "ja",
  "ru",
  "hi",
] as const

const FLUENCY_LEVELS: Fluency[] = ["Conversational", "Fluent", "Native"]

function isFluency(value: string): value is Fluency {
  return FLUENCY_LEVELS.some((level) => level === value)
}

export function OnboardingLanguagesStep({
  languages,
  onLanguagesChange,
  onNext,
  onBack,
}: OnboardingLanguagesStepProps) {
  const { t } = useTranslation()

  function setFluency(code: string, fluency: Fluency) {
    onLanguagesChange(
      languages.map((l) => (l.code === code ? { ...l, fluency } : l))
    )
  }

  function removeLanguage(code: string) {
    onLanguagesChange(languages.filter((l) => l.code !== code))
  }

  function addLanguage(code: string) {
    if (languages.some((l) => l.code === code)) return
    const entry = getLanguageByCode(code)
    if (!entry) return
    onLanguagesChange([
      ...languages,
      { code: entry.code, name: entry.name, fluency: "Conversational" },
    ])
  }

  const addedCodes = new Set(languages.map((l) => l.code))
  const suggestions = SUGGESTED_CODES.filter((code) => !addedCodes.has(code))
    .map((code) => getLanguageByCode(code))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  return (
    <section className="mt-12">
      <button type="button" className="onboarding-back mb-8" onClick={onBack}>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t("Back")}
        </span>
      </button>
      <p className="onboarding-eyebrow mb-6">
        {t("Step {{current}} of {{total}}", { current: 2, total: 3 })}
      </p>
      <h1 className="onboarding-step-heading mb-4">
        {t("What languages do you speak?")}
      </h1>
      <p className="onboarding-step-subline mb-10">
        {t("Sondra only connects you with people you can actually talk to.")}
      </p>

      <div className="mb-8 flex flex-col gap-3">
        {languages.map((lang) => (
          <div key={lang.code} className="onboarding-lang-row">
            <span className="onboarding-lang-name">{t(lang.name)}</span>
            <div className="flex items-center gap-3">
              <ToggleGroup
                spacing={6}
                value={[lang.fluency]}
                onValueChange={(next) => {
                  const picked = next[0]
                  if (picked && isFluency(picked)) setFluency(lang.code, picked)
                }}
                className="onboarding-fluency-group"
                aria-label={`${t("Fluency")} — ${t(lang.name)}`}
              >
                {FLUENCY_LEVELS.map((level) => (
                  <ToggleGroupItem
                    key={level}
                    value={level}
                    className="onboarding-fluency-item border-transparent bg-transparent px-3 data-[state=on]:bg-primary"
                  >
                    {t(level)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <button
                type="button"
                className="onboarding-lang-remove"
                onClick={() => removeLanguage(lang.code)}
                aria-label={t("Remove {{language}}", { language: t(lang.name) })}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <>
          <p className="onboarding-section-label mb-3">{t("Add another")}</p>
          <div className="onboarding-chip-row mb-10">
            {suggestions.map((entry) => (
              <button
                key={entry.code}
                type="button"
                className="onboarding-chip"
                onClick={() => addLanguage(entry.code)}
              >
                {t(entry.name)}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onNext}
          disabled={languages.length === 0}
        >
          {t("Continue →")}
        </Button>
      </div>
    </section>
  )
}

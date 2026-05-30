import { useTranslation } from "react-i18next"
import { ArrowLeft, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { LANGUAGES, getLanguageByCode, type LanguageEntry } from "@/lib/languages"
import { cn } from "@/lib/utils"

export type Fluency = "Conversational" | "Fluent" | "Native"

export interface OnboardingLanguage {
  code: string
  name: string
  fluency: Fluency
}

interface OnboardingLanguagesStepProps {
  languages: OnboardingLanguage[]
  primaryCode: string | null
  onLanguagesChange: (next: OnboardingLanguage[]) => void
  onPrimaryChange: (code: string) => void
  onNext: () => void
  onBack: () => void
  isSubmitting?: boolean
}

const FLUENCY_LEVELS: Fluency[] = ["Conversational", "Fluent", "Native"]

function isFluency(value: string): value is Fluency {
  return FLUENCY_LEVELS.some((level) => level === value)
}

export function OnboardingLanguagesStep({
  languages,
  primaryCode,
  onLanguagesChange,
  onPrimaryChange,
  onNext,
  onBack,
  isSubmitting,
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
  const remaining = LANGUAGES.filter((entry) => !addedCodes.has(entry.code))

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

      <div className="mb-4 flex flex-col gap-3">
        {languages.map((lang) => {
          const isPrimary = lang.code === primaryCode
          return (
            <div key={lang.code} className="onboarding-lang-row">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPrimaryChange(lang.code)}
                  aria-pressed={isPrimary}
                  aria-label={t("Make {{language}} my primary language", {
                    language: t(lang.name),
                  })}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isPrimary
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      isPrimary && "fill-primary",
                    )}
                    aria-hidden
                  />
                </button>
                <span className="onboarding-lang-name">{t(lang.name)}</span>
              </div>
              <div className="flex items-center gap-3">
                <ToggleGroup
                  spacing={6}
                  value={[lang.fluency]}
                  onValueChange={(next) => {
                    const picked = next[0]
                    if (picked && isFluency(picked))
                      setFluency(lang.code, picked)
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
                  aria-label={t("Remove {{language}}", {
                    language: t(lang.name),
                  })}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {languages.length > 0 && (
        <p className="mb-8 text-xs text-muted-foreground">
          {t(
            "Tap the star to choose your primary language — we'll send you calendar invites and emails in this one.",
          )}
        </p>
      )}

      {remaining.length > 0 && (
        <div className="mb-10">
          <p className="onboarding-section-label mb-3">{t("Add another")}</p>
          <Combobox<LanguageEntry>
            items={remaining}
            value={null}
            itemToStringLabel={(entry) => t(entry.name)}
            isItemEqualToValue={(a, b) => a.code === b.code}
            onValueChange={(picked) => {
              if (!picked) return
              addLanguage(picked.code)
            }}
          >
            <ComboboxInput
              placeholder={t("Search languages…")}
              className="w-full"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty>{t("No matches")}</ComboboxEmpty>
                <ComboboxCollection>
                  {(entry: LanguageEntry) => (
                    <ComboboxItem key={entry.code} value={entry}>
                      {t(entry.name)}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}

      <div className="mt-6">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onNext}
          disabled={
            languages.length === 0 || primaryCode === null || isSubmitting
          }
        >
          {isSubmitting ? t("Saving…") : t("Continue →")}
        </Button>
      </div>
    </section>
  )
}

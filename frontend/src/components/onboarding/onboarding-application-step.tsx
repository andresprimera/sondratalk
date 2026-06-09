import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FieldDescription } from "@/components/ui/field"

interface OnboardingApplicationStepProps {
  value: string
  onChange: (value: string) => void
  onNext: () => void
  onBack: () => void
  isSubmitting?: boolean
}

export function OnboardingApplicationStep({
  value,
  onChange,
  onNext,
  onBack,
  isSubmitting,
}: OnboardingApplicationStepProps) {
  const { t } = useTranslation()

  return (
    <section className="mt-12">
      <button type="button" className="onboarding-back mb-8" onClick={onBack}>
        <span className="inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> {t("Back")}
        </span>
      </button>

      <p className="onboarding-eyebrow mb-6">{t("Almost there")}</p>
      <h1 className="onboarding-step-heading mb-4">
        {t("One last thing before you join")}
      </h1>
      <p className="onboarding-step-subline mb-10">
        {t("We review every application. Not because we're selective — because every person here chose to be.")}
      </p>

      <div className="mb-6 flex flex-col gap-3">
        <label
          htmlFor="application-text"
          className="text-sm font-medium text-foreground"
        >
          {t("Why are you looking for these conversations?")}
        </label>
        <Textarea
          id="application-text"
          rows={5}
          maxLength={1000}
          placeholder={t("Share as much or as little as you'd like.")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none text-base"
        />
        <FieldDescription>
          {t("We'll review your application and get back to you within 48 hours.")}
        </FieldDescription>
      </div>

      <Button
        size="lg"
        onClick={onNext}
        disabled={isSubmitting || value.trim().length === 0}
      >
        {isSubmitting ? t("Submitting...") : t("Submit application")}
      </Button>
    </section>
  )
}

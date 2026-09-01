import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RegistrationInfoStepProps {
  heading: string
  sub: string
  buttonLabel: string
  onNext: () => void
  /** Renders the heading as an italic serif quote (used by the opener). */
  quote?: boolean
  /** Optional citation shown under the sub-text. */
  source?: string
  /** Optional fine print shown under the button. */
  fine?: string
  onBack?: () => void
}

export function RegistrationInfoStep({
  heading,
  sub,
  buttonLabel,
  onNext,
  quote = false,
  source,
  fine,
  onBack,
}: RegistrationInfoStepProps) {
  const { t } = useTranslation()
  return (
    <section className="mt-10 max-w-xl">
      {onBack && (
        <button type="button" className="onboarding-back mb-8" onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> {t("Back")}
          </span>
        </button>
      )}
      <div className="onboarding-rule mb-6" aria-hidden />
      <h1 className={quote ? "onboarding-quote mb-4" : "onboarding-step-heading mb-4"}>
        {heading}
      </h1>
      <p className="onboarding-step-subline mb-6">{sub}</p>
      {source && <p className="onboarding-source mb-8 max-w-md">{source}</p>}
      <div className="mt-2">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onNext}
        >
          {buttonLabel}
        </Button>
      </div>
      {fine && (
        <p className="mt-6 text-sm font-light text-muted-foreground/60">{fine}</p>
      )}
    </section>
  )
}

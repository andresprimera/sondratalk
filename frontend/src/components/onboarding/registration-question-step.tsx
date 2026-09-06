import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface RegistrationOption {
  value: string
  label: string
  reply?: string
  source?: string
}

interface RegistrationQuestionStepProps {
  counter: string
  heading: string
  subline?: string
  options: RegistrationOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  /** Renders as a multi-select; `value` is then a string[]. */
  multi?: boolean
  /** Minimum picks required to continue when `multi`. */
  minSelect?: number
  /** Optional free-text alternative for single-select questions. */
  freeText?: { placeholder: string; reply: string }
  /** Fixed reply shown for multi-select questions. */
  multiReply?: string
  onBack?: () => void
  onNext: () => void
}

export function RegistrationQuestionStep({
  counter,
  heading,
  subline,
  options,
  value,
  onChange,
  multi = false,
  minSelect = 1,
  freeText,
  multiReply,
  onBack,
  onNext,
}: RegistrationQuestionStepProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  const selectedValues = multi
    ? (Array.isArray(value) ? value : [])
    : []
  const singleValue = multi ? "" : typeof value === "string" ? value : ""

  const isOptionValue = options.some((o) => o.value === singleValue)
  const freeTextValue = !multi && !isOptionValue ? singleValue : ""

  function selectSingle(next: string) {
    setRevealed(false)
    onChange(next)
  }

  function toggleMulti(next: string) {
    setRevealed(false)
    const set = new Set(selectedValues)
    if (set.has(next)) set.delete(next)
    else set.add(next)
    onChange([...set])
  }

  function handleFreeText(text: string) {
    setRevealed(false)
    onChange(text)
  }

  const canSubmit = multi
    ? selectedValues.length >= minSelect
    : singleValue.trim().length > 0

  const selectedOption = options.find((o) => o.value === singleValue)
  const replyText = multi
    ? multiReply
    : selectedOption
      ? selectedOption.reply
      : freeText?.reply
  const replySource = multi ? undefined : selectedOption?.source

  return (
    <section className="mt-10 max-w-xl">
      {onBack && (
        <button type="button" className="onboarding-back mb-8" onClick={onBack}>
          <span className="inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> {t("Back")}
          </span>
        </button>
      )}
      <p className="onboarding-eyebrow mb-6">{counter}</p>
      <h1 className="onboarding-step-heading mb-4">{heading}</h1>
      {subline && <p className="onboarding-step-subline mb-8">{subline}</p>}

      <div className="onboarding-chip-row">
        {options.map((option) => {
          const isSelected = multi
            ? selectedValues.includes(option.value)
            : option.value === singleValue
          return (
            <button
              key={option.value}
              type="button"
              className="onboarding-chip"
              data-selected={isSelected}
              aria-pressed={isSelected}
              onClick={() =>
                multi ? toggleMulti(option.value) : selectSingle(option.value)
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {freeText && (
        <input
          type="text"
          className="onboarding-field mt-4"
          placeholder={freeText.placeholder}
          value={freeTextValue}
          onChange={(event) => handleFreeText(event.target.value)}
        />
      )}

      {multi && (
        <p className="mt-4 text-sm italic font-light text-muted-foreground/70">
          {t("Pick at least {{count}}.", { count: minSelect })}
        </p>
      )}

      <div
        className="onboarding-reply mt-8"
        data-visible={revealed}
        aria-hidden={!revealed}
      >
        <div className="onboarding-reply-inner">
          <p className="onboarding-reply-text">{replyText}</p>
          {replySource && (
            <div className="onboarding-reply-source">{replySource}</div>
          )}
        </div>
      </div>

      <div className="mt-8">
        {revealed ? (
          <Button
            size="xl"
            className="landing-flicker tracking-[0.05em]"
            onClick={onNext}
          >
            {t("Continue")}
          </Button>
        ) : (
          <Button
            size="xl"
            className="landing-flicker tracking-[0.05em]"
            disabled={!canSubmit}
            onClick={() => setRevealed(true)}
          >
            {t("Submit answer")}
          </Button>
        )}
      </div>
    </section>
  )
}

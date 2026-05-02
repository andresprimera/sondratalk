import { useTranslation } from "react-i18next"

interface OnboardingProgressProps {
  current: 1 | 2 | 3
  total: 3
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const { t } = useTranslation()
  const steps: Array<1 | 2 | 3> = [1, 2, 3]

  return (
    <div
      className="onboarding-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={t("Step {{current}} of {{total}}", { current, total })}
    >
      {steps.map((n) => {
        const state = n === current ? "active" : n < current ? "done" : "pending"
        return (
          <span
            key={n}
            className="onboarding-progress-dot"
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
          />
        )
      })}
    </div>
  )
}

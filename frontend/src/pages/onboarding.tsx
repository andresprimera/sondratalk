// Onboarding is a transient pre-dashboard ceremony. State is intentionally
// component-local — no react-hook-form, no API calls — until persistence lands.
import { useState } from "react"
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress"
import { OnboardingLocationStep } from "@/components/onboarding/onboarding-location-step"
import {
  OnboardingLanguagesStep,
  type OnboardingLanguage,
} from "@/components/onboarding/onboarding-languages-step"
import { OnboardingCirclesStep } from "@/components/onboarding/onboarding-circles-step"
import { OnboardingWelcomeStep } from "@/components/onboarding/onboarding-welcome-step"
import { detectTimezone } from "@/lib/timezones"
import { detectBrowserLanguage } from "@/lib/languages"

type Step = 1 | 2 | 3 | 4

function detectInitialIana(): string {
  const detected = detectTimezone()
  if (detected) return detected.iana
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function detectInitialLanguages(): OnboardingLanguage[] {
  const lang = detectBrowserLanguage()
  if (!lang) return []
  return [{ code: lang.code, name: lang.name, fluency: "Native" }]
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1)
  const [detectedIana] = useState(detectInitialIana)
  const [selectedIana, setSelectedIana] = useState(detectedIana)
  const [languages, setLanguages] = useState<OnboardingLanguage[]>(
    detectInitialLanguages
  )
  const [circles, setCircles] = useState<string[]>([])
  const [circleInput, setCircleInput] = useState("")

  function go(next: Step) {
    setStep(next)
    window.scrollTo(0, 0)
  }

  return (
    <div className="onboarding-bg relative flex min-h-svh flex-col text-foreground">
      <div className="onboarding-grain" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-[520px] items-center justify-between px-6 pt-8">
        <span className="onboarding-logo">Sondra</span>
        {step !== 4 && <OnboardingProgress current={step} total={3} />}
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[520px] flex-1 px-6 pb-20">
        {step === 1 && (
          <OnboardingLocationStep
            selectedIana={selectedIana}
            onSelectIana={setSelectedIana}
            detectedIana={detectedIana}
            onNext={() => go(2)}
          />
        )}
        {step === 2 && (
          <OnboardingLanguagesStep
            languages={languages}
            onLanguagesChange={setLanguages}
            onNext={() => go(3)}
            onBack={() => go(1)}
          />
        )}
        {step === 3 && (
          <OnboardingCirclesStep
            circles={circles}
            onCirclesChange={setCircles}
            inputValue={circleInput}
            onInputChange={setCircleInput}
            onNext={() => go(4)}
            onBack={() => go(2)}
          />
        )}
        {step === 4 && <OnboardingWelcomeStep />}
      </main>
    </div>
  )
}

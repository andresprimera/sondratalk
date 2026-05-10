// Onboarding is a transient pre-dashboard ceremony. Step 1 confirms the
// timezone we inferred at signup (user can change it) and step 3 persists
// circle memberships; languages (step 2) is still local-state-only.
import { useState } from "react"
import { Navigate } from "react-router"
import { useTranslation } from "react-i18next"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress"
import { OnboardingLocationStep } from "@/components/onboarding/onboarding-location-step"
import {
  OnboardingLanguagesStep,
  type OnboardingLanguage,
} from "@/components/onboarding/onboarding-languages-step"
import {
  OnboardingCirclesStep,
  type OnboardingCircle,
} from "@/components/onboarding/onboarding-circles-step"
import { OnboardingWelcomeStep } from "@/components/onboarding/onboarding-welcome-step"
import { detectTimezone } from "@/lib/timezones"
import { detectBrowserLanguage } from "@/lib/languages"
import {
  fetchMyCirclesApi,
  updateMyCirclesApi,
} from "@/lib/memberships"
import { updateTimezoneApi } from "@/lib/profile"
import { useAuth } from "@/hooks/use-auth"

type Step = 1 | 2 | 3 | 4

function detectInitialIana(fallback: string): string {
  const detected = detectTimezone()
  if (detected) return detected.iana
  return fallback
}

function detectInitialLanguages(): OnboardingLanguage[] {
  const lang = detectBrowserLanguage()
  if (!lang) return []
  return [{ code: lang.code, name: lang.name, fluency: "Native" }]
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { updateUser, user } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [detectedIana] = useState(() =>
    detectInitialIana(
      user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  )
  const [selectedIana, setSelectedIana] = useState(
    () => user?.timezone ?? detectedIana,
  )
  const [languages, setLanguages] = useState<OnboardingLanguage[]>(
    detectInitialLanguages
  )
  const [circles, setCircles] = useState<OnboardingCircle[]>([])
  const [circleInput, setCircleInput] = useState("")

  const myCirclesQuery = useQuery({
    queryKey: ["users", "me", "circles"] as const,
    queryFn: fetchMyCirclesApi,
  })

  const submitMutation = useMutation({
    mutationFn: updateMyCirclesApi,
    onSuccess: (data) => {
      queryClient.setQueryData(["users", "me", "circles"], data)
      setStep(4)
      window.scrollTo(0, 0)
    },
    onError: () => {
      toast.error(t("Failed to save your circles"))
    },
  })

  const timezoneMutation = useMutation({
    mutationFn: updateTimezoneApi,
    onSuccess: (data) => {
      if (user) updateUser({ ...user, timezone: data.timezone })
      setStep(2)
      window.scrollTo(0, 0)
    },
    onError: () => {
      toast.error(t("Failed to save your timezone"))
    },
  })

  function go(next: Step) {
    setStep(next)
    window.scrollTo(0, 0)
  }

  function handleSubmit() {
    submitMutation.mutate({ circleIds: circles.map((c) => c.id) })
  }

  // Skip onboarding only when the user already has memberships. Gating on
  // `isSuccess` means a brief flash of step 1 for returning users (until
  // the query resolves and the redirect kicks in) — acceptable because
  // returning users almost never land on /onboarding directly. Step !== 4
  // keeps the welcome screen reachable after a fresh submit, since the
  // mutation seeds the cache before advancing to step 4.
  if (
    step !== 4 &&
    myCirclesQuery.isSuccess &&
    myCirclesQuery.data.length > 0
  ) {
    return <Navigate to="/dashboard" replace />
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
            onNext={() => timezoneMutation.mutate(selectedIana)}
            isSubmitting={timezoneMutation.isPending}
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
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
            onBack={() => go(2)}
          />
        )}
        {step === 4 && <OnboardingWelcomeStep />}
      </main>
    </div>
  )
}

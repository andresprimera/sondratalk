// Onboarding is a transient pre-dashboard ceremony. Step 1 confirms the
// timezone we inferred at signup; step 2 persists the languages spoken plus
// a primary language used for email/calendar invites; step 3 persists circle
// memberships; step 4 is the welcome screen.
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
import { LanguageToggle } from "@/components/language-toggle"
import { detectTimezone } from "@/lib/timezones"
import { detectBrowserLanguage } from "@/lib/languages"
import {
  fetchMyCirclesApi,
  updateMyCirclesApi,
} from "@/lib/memberships"
import { updateTimezoneApi, updateMyLanguagesApi } from "@/lib/profile"
import { useAuth } from "@/hooks/use-auth"

type SupportedEmailLocale = "en" | "es"

function localeFromPrimary(primaryCode: string | null): SupportedEmailLocale {
  if (primaryCode === "es") return "es"
  return "en"
}

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
  const [detectedCity] = useState(() => detectTimezone()?.city ?? user?.city ?? "")
  const [selectedIana, setSelectedIana] = useState(
    () => user?.timezone ?? detectedIana,
  )
  const [selectedCity, setSelectedCity] = useState(
    () => user?.city ?? detectedCity,
  )
  const [languages, setLanguages] = useState<OnboardingLanguage[]>(
    detectInitialLanguages
  )
  const [primaryCode, setPrimaryCode] = useState<string | null>(
    () => detectInitialLanguages()[0]?.code ?? null,
  )
  const [circles, setCircles] = useState<OnboardingCircle[]>([])

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
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("Failed to save your circles"),
      )
    },
  })

  const timezoneMutation = useMutation({
    mutationFn: updateTimezoneApi,
    onSuccess: (data) => {
      if (user) updateUser({ ...user, timezone: data.timezone, city: data.city })
      setStep(2)
      window.scrollTo(0, 0)
    },
    onError: () => {
      toast.error(t("Failed to save your timezone"))
    },
  })

  const languagesMutation = useMutation({
    mutationFn: updateMyLanguagesApi,
    onSuccess: (data) => {
      if (user) {
        updateUser({
          ...user,
          languages: data.languages,
          locale: data.locale,
        })
      }
      setStep(3)
      window.scrollTo(0, 0)
    },
    onError: () => {
      toast.error(t("Failed to save your languages"))
    },
  })

  function handleLanguagesNext() {
    if (!primaryCode) return
    languagesMutation.mutate({
      languages: languages.map(({ code, fluency }) => ({ code, fluency })),
      locale: localeFromPrimary(primaryCode),
    })
  }

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
  // circles mutation seeds the cache before advancing to the welcome step.
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

      <header className="relative z-10 mx-auto flex w-full max-w-[680px] items-center justify-between px-6 pt-8">
        <span className="onboarding-logo">Sondra</span>
        <div className="flex items-center gap-3">
          {step !== 4 && <OnboardingProgress current={step} total={3} />}
          <LanguageToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[680px] flex-1 px-6 pb-20">
        {step === 1 && (
          <OnboardingLocationStep
            selectedIana={selectedIana}
            onSelectIana={setSelectedIana}
            selectedCity={selectedCity}
            onSelectCity={setSelectedCity}
            detectedIana={detectedIana}
            detectedCity={detectedCity}
            onNext={() => timezoneMutation.mutate({ timezone: selectedIana, city: selectedCity })}
            isSubmitting={timezoneMutation.isPending}
          />
        )}
        {step === 2 && (
          <OnboardingLanguagesStep
            languages={languages}
            primaryCode={primaryCode}
            onLanguagesChange={(next) => {
              setLanguages(next)
              // Keep primary in sync: if it's missing (or pointing at a removed
              // language), default to the first item in the list so the user
              // doesn't have to explicitly star it.
              if (next.length === 0) {
                setPrimaryCode(null)
              } else if (
                !primaryCode ||
                !next.some((l) => l.code === primaryCode)
              ) {
                setPrimaryCode(next[0].code)
              }
            }}
            onPrimaryChange={setPrimaryCode}
            onNext={handleLanguagesNext}
            onBack={() => go(1)}
            isSubmitting={languagesMutation.isPending}
          />
        )}
        {step === 3 && (
          <OnboardingCirclesStep
            circles={circles}
            onCirclesChange={setCircles}
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

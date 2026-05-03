import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query"
import { ArrowLeft, Loader2, X } from "lucide-react"
import type { Circle } from "@base-dashboard/shared"
import { fetchCirclesApi } from "@/lib/circles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface OnboardingCirclesStepProps {
  circles: string[]
  onCirclesChange: (next: string[]) => void
  inputValue: string
  onInputChange: (value: string) => void
  onNext: () => void
  onBack: () => void
}

const PAGE_SIZE = 24
const SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-28"] as const

export function OnboardingCirclesStep({
  circles,
  onCirclesChange,
  inputValue,
  onInputChange,
  onNext,
  onBack,
}: OnboardingCirclesStepProps) {
  const { t, i18n } = useTranslation()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"

  const [debouncedQ, setDebouncedQ] = useState("")
  useEffect(() => {
    const trimmed = inputValue.trim()
    const next = trimmed.length >= 3 ? trimmed : ""
    const id = setTimeout(() => setDebouncedQ(next), 250)
    return () => clearTimeout(id)
  }, [inputValue])

  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "onboarding-circles",
      { q: debouncedQ, locale, pageSize: PAGE_SIZE },
    ] as const,
    queryFn: ({ pageParam }) =>
      fetchCirclesApi({
        q: debouncedQ || undefined,
        locale,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    placeholderData: keepPreviousData,
  })

  const fetchedCircles: Circle[] = data?.pages.flatMap((p) => p.data) ?? []

  function add(name: string) {
    const clean = name.trim()
    if (!clean || circles.includes(clean)) return
    onCirclesChange([...circles, clean])
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

      <div className="mb-6">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={t("Search circles...")}
          className="h-11 text-base"
        />
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

      {isLoading ? (
        <div className="onboarding-chip-row mb-10" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-[34px] ${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]} rounded-full`}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="mb-10 flex items-center gap-3">
          <p className="onboarding-section-label">
            {t("Failed to load circles.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("Try again")}
          </Button>
        </div>
      ) : fetchedCircles.length === 0 ? (
        <p className="onboarding-section-label mb-10">
          {t("No circles match your search.")}
        </p>
      ) : (
        <>
          <div className="onboarding-chip-row mb-4">
            {fetchedCircles.map((c) => {
              const label = c.labels[locale]
              // Comparing by localized label: known limitation if the user
              // toggles UI language mid-onboarding (chip may re-enable,
              // allowing a duplicate). Acceptable until persistence lands.
              const used = circles.includes(label)
              return (
                <button
                  key={c.id}
                  type="button"
                  className="onboarding-chip"
                  data-used={used}
                  onClick={() => add(label)}
                  aria-pressed={used}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {hasNextPage && (
            <div className="mb-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {t("Load more")}
              </Button>
            </div>
          )}
        </>
      )}

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

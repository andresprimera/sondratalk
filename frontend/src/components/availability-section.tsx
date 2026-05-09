import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { AlertCircleIcon, ArrowRight, CalendarClock } from "lucide-react"
import { summarizeCondensed } from "@/lib/availability"
import { AvailabilityMiniGrid } from "@/components/availability-mini-grid"
import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyAvailabilityQuery } from "@/hooks/use-my-availability"

export function AvailabilitySection() {
  const { t } = useTranslation()
  const query = useMyAvailabilityQuery()

  if (query.isLoading) {
    return <Skeleton className="h-24 w-full" />
  }

  if (query.isError) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <AlertCircleIcon className="size-4 text-destructive" />
        <span>{t("Failed to load availability.")}</span>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          {t("Try again")}
        </Button>
      </div>
    )
  }

  const windows = query.data?.windows ?? []

  if (windows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <h6 className="mb-1">{t("Availability")}</h6>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Tell us when you're around so people can find you at the right times.",
                )}
              </p>
            </div>
          </div>
          <Button render={<Link to="/dashboard/availability" />}>
            {t("Set up your availability")} <ArrowRight />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <section>
      <SectionHeader
        title={t("Availability")}
        action={
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/dashboard/availability" />}
          >
            {t("Edit")} <ArrowRight />
          </Button>
        }
      />
      <div className="flex items-start justify-between gap-5">
        <div className="flex-1">
          <p className="text-base text-foreground">
            {summarizeCondensed(windows, t)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("When people can schedule time with you")}
          </p>
        </div>
        <AvailabilityMiniGrid windows={windows} />
      </div>
    </section>
  )
}

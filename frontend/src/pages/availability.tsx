import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AlertCircleIcon, ChevronLeft } from "lucide-react"
import {
  type AvailabilityWindow,
  type Day,
  type Period,
  generateSlots,
  summarize,
  toggleWindow,
} from "@/lib/availability"
import { AvailabilityGrid } from "@/components/availability-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  useMyAvailabilityQuery,
  useUpdateMyAvailability,
} from "@/hooks/use-my-availability"
import { cn } from "@/lib/utils"

const MAX_SLOT_CHIPS = 14

export default function AvailabilityPage() {
  const { t } = useTranslation()
  const query = useMyAvailabilityQuery()
  const updateMutation = useUpdateMyAvailability()

  const [draftWindows, setDraftWindows] = useState<AvailabilityWindow[]>([])
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!seeded && query.data) {
      setDraftWindows(query.data.windows)
      setSeeded(true)
    }
  }, [seeded, query.data])

  const isAvailableNow = query.data?.isAvailableNow ?? false

  function handleToggle(period: Period, day: Day) {
    setDraftWindows((prev) => toggleWindow(prev, period, day))
  }

  function handleSave() {
    updateMutation.mutate(
      { windows: draftWindows },
      {
        onSuccess: () => toast.success(t("Saved")),
      },
    )
  }

  function handleToggleNow(value: boolean) {
    updateMutation.mutate({ isAvailableNow: value })
  }

  const summaryFragments = summarize(draftWindows, t)
  const slots = generateSlots(draftWindows, t)
  const visibleSlots = slots.slice(0, MAX_SLOT_CHIPS)
  const overflow = slots.length - visibleSlots.length

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2"
        render={<Link to="/dashboard" />}
      >
        <ChevronLeft /> {t("Dashboard")}
      </Button>

      <div className="mb-2 text-[0.6875rem] tracking-widest text-primary/80 uppercase">
        {t("Your availability")}
      </div>
      <h1 className="mb-2">{t("When are you usually here?")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t(
          "We use this to surface you at the right moments — and to show people when they can reach you.",
        )}
      </p>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "size-2.5 rounded-full",
                isAvailableNow
                  ? "bg-primary shadow-[0_0_6px_var(--color-primary)]"
                  : "bg-muted-foreground/30",
              )}
              aria-hidden
            />
            <div>
              <div className="text-sm">{t("Available right now")}</div>
              <div className="text-sm text-muted-foreground">
                {t("Turn this off when you need to step away.")}
              </div>
            </div>
          </div>
          <Switch
            checked={isAvailableNow}
            disabled={query.isLoading}
            onCheckedChange={handleToggleNow}
          />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="mb-5">
        <h6 className="mb-1">{t("Your weekly windows")}</h6>
        <p className="text-sm text-muted-foreground">
          {t("Tap to toggle. We'll handle the exact times.")}
        </p>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AlertCircleIcon className="size-4 text-destructive" />
          <span>{t("Failed to load availability.")}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t("Try again")}
          </Button>
        </div>
      ) : (
        <>
          <AvailabilityGrid
            windows={draftWindows}
            onToggle={handleToggle}
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("You're set for:")}
            </span>
            {summaryFragments.length === 0 ? (
              <span className="text-sm text-muted-foreground/60 italic">
                {t("Nothing set yet — tap cells above.")}
              </span>
            ) : (
              summaryFragments.map((fragment) => (
                <Badge key={fragment} variant="secondary">
                  {fragment}
                </Badge>
              ))
            )}
          </div>

          {draftWindows.length > 0 && (
            <Card className="mt-6">
              <CardContent>
                <div className="mb-3 text-[0.6875rem] tracking-widest text-muted-foreground/60 uppercase">
                  {t("People will see you available at")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleSlots.map((slot) => (
                    <Badge key={slot} variant="outline">
                      {slot}
                    </Badge>
                  ))}
                  {overflow > 0 && (
                    <Badge
                      variant="outline"
                      className="border-dashed text-muted-foreground/60"
                    >
                      {t("+{{count}} more", { count: overflow })}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground/60 italic">
                  {t(
                    "Exact times are generated from your windows. You don't set them manually.",
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={query.isLoading || updateMutation.isPending}
        >
          {updateMutation.isPending ? t("Saving...") : t("Save windows")}
        </Button>
        <span className="text-sm text-muted-foreground italic">
          {t("Changes apply within a few minutes.")}
        </span>
      </div>
    </div>
  )
}

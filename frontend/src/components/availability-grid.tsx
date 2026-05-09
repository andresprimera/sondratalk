import { useTranslation } from "react-i18next"
import {
  type AvailabilityWindow,
  type Day,
  type Period,
  DAY_SHORT_KEYS,
  PERIODS,
  PERIOD_LABEL_KEYS,
  PERIOD_TIME_KEYS,
  WEEKDAYS,
  WEEKEND,
  hasWindow,
} from "@/lib/availability"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface AvailabilityGridProps {
  windows: AvailabilityWindow[]
  onToggle: (period: Period, day: Day) => void
}

export function AvailabilityGrid({ windows, onToggle }: AvailabilityGridProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="w-20 shrink-0" aria-hidden />
        <div className="flex flex-[5] flex-col gap-1">
          <div className="text-center text-[0.625rem] tracking-widest text-muted-foreground/60 uppercase">
            {t("Weekdays")}
          </div>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="flex-1 text-center text-sm tracking-wider text-muted-foreground"
              >
                {t(DAY_SHORT_KEYS[day])}
              </div>
            ))}
          </div>
        </div>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <div className="flex flex-[2] flex-col gap-1">
          <div className="text-center text-[0.625rem] tracking-widest text-muted-foreground/60 uppercase">
            {t("Weekend")}
          </div>
          <div className="flex gap-1.5">
            {WEEKEND.map((day) => (
              <div
                key={day}
                className="flex-1 text-center text-sm tracking-wider text-muted-foreground"
              >
                {t(DAY_SHORT_KEYS[day])}
              </div>
            ))}
          </div>
        </div>
      </div>

      {PERIODS.map((period) => (
        <div key={period} className="flex items-center gap-2">
          <div className="flex w-20 shrink-0 flex-col">
            <span className="text-sm text-foreground">
              {t(PERIOD_LABEL_KEYS[period])}
            </span>
            <span className="text-[0.625rem] tracking-wider text-muted-foreground/60">
              {t(PERIOD_TIME_KEYS[period])}
            </span>
          </div>
          <div className="flex flex-[5] gap-1.5">
            {WEEKDAYS.map((day) => (
              <Cell
                key={day}
                on={hasWindow(windows, period, day)}
                onClick={() => onToggle(period, day)}
              />
            ))}
          </div>
          <Separator orientation="vertical" className="mx-1 h-10" />
          <div className="flex flex-[2] gap-1.5">
            {WEEKEND.map((day) => (
              <Cell
                key={day}
                on={hasWindow(windows, period, day)}
                onClick={() => onToggle(period, day)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface CellProps {
  on: boolean
  onClick: () => void
}

function Cell({ on, onClick }: CellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-10 flex-1 items-center justify-center rounded-md border transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        on
          ? "border-primary bg-primary/15 ring-1 ring-primary/30"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full transition-opacity",
          on ? "bg-primary opacity-70" : "opacity-0",
        )}
      />
    </button>
  )
}

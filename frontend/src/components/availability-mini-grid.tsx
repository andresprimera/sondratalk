import { Fragment } from "react"
import { useTranslation } from "react-i18next"
import {
  type AvailabilityWindow,
  DAYS,
  DAY_SHORT_KEYS,
  PERIODS,
  hasWindow,
} from "@/lib/availability"
import { cn } from "@/lib/utils"

interface AvailabilityMiniGridProps {
  windows: AvailabilityWindow[]
}

export function AvailabilityMiniGrid({ windows }: AvailabilityMiniGridProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1.5">
        {DAYS.map((day, i) => (
          <Fragment key={day}>
            {i === 5 && <div aria-hidden className="w-2.5" />}
            <div className="flex flex-col gap-1">
              {PERIODS.map((period) => {
                const on = hasWindow(windows, period, day)
                return (
                  <div
                    key={`${period}-${day}`}
                    className={cn(
                      "h-3 w-6 rounded-sm",
                      on ? "bg-primary/60" : "bg-muted",
                    )}
                  />
                )
              })}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="flex gap-1.5">
        {DAYS.map((day, i) => (
          <Fragment key={day}>
            {i === 5 && <div aria-hidden className="w-2.5" />}
            <span className="w-6 text-center text-[0.625rem] text-muted-foreground/60">
              {t(DAY_SHORT_KEYS[day]).charAt(0)}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

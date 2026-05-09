import {
  type Period,
  type Day,
  type AvailabilityWindow,
  type Availability,
  type UpdateAvailabilityInput,
  periodEnum,
  dayEnum,
} from "@base-dashboard/shared"
import { authFetch } from "@/lib/api"

export type {
  Period,
  Day,
  AvailabilityWindow,
  Availability,
  UpdateAvailabilityInput,
}

export const PERIODS = periodEnum.options
export const DAYS = dayEnum.options
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const
export const WEEKEND = ["sat", "sun"] as const

export interface PeriodTime {
  start: number
  end: number
  slots: string[]
}

export const PERIOD_TIMES: Record<Period, PeriodTime> = {
  morning: { start: 7, end: 12, slots: ["8:00", "9:00", "10:00", "11:00"] },
  afternoon: { start: 12, end: 18, slots: ["13:00", "14:00", "15:00", "16:00"] },
  evening: { start: 18, end: 22, slots: ["18:00", "19:00", "20:00", "21:00"] },
}

export const PERIOD_LABEL_KEYS: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

export const PERIOD_TIME_KEYS: Record<Period, string> = {
  morning: "7 – 12",
  afternoon: "12 – 6",
  evening: "6 – 10",
}

export const DAY_SHORT_KEYS: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
}

const FULL_PERIOD_KEYS: Record<Period, string> = {
  morning: "Mornings",
  afternoon: "Afternoons",
  evening: "Evenings",
}

const WEEKDAY_PERIOD_KEYS: Record<Period, string> = {
  morning: "Weekday mornings",
  afternoon: "Weekday afternoons",
  evening: "Weekday evenings",
}

const WEEKEND_PERIOD_KEYS: Record<Period, string> = {
  morning: "Weekend mornings",
  afternoon: "Weekend afternoons",
  evening: "Weekend evenings",
}

export type TFn = (key: string, options?: Record<string, unknown>) => string

export function hasWindow(
  windows: AvailabilityWindow[],
  period: Period,
  day: Day,
): boolean {
  return windows.some((w) => w.period === period && w.day === day)
}

export function toggleWindow(
  windows: AvailabilityWindow[],
  period: Period,
  day: Day,
): AvailabilityWindow[] {
  return hasWindow(windows, period, day)
    ? windows.filter((w) => !(w.period === period && w.day === day))
    : [...windows, { period, day }]
}

export function summarize(
  windows: AvailabilityWindow[],
  t: TFn,
): string[] {
  const fragments: string[] = []
  for (const period of PERIODS) {
    const hasWd = WEEKDAYS.some((d) => hasWindow(windows, period, d))
    const hasWe = WEEKEND.some((d) => hasWindow(windows, period, d))
    if (hasWd && hasWe) fragments.push(t(FULL_PERIOD_KEYS[period]))
    else if (hasWd) fragments.push(t(WEEKDAY_PERIOD_KEYS[period]))
    else if (hasWe) fragments.push(t(WEEKEND_PERIOD_KEYS[period]))
  }
  return fragments
}

export function summarizeCondensed(
  windows: AvailabilityWindow[],
  t: TFn,
): string {
  const fragments = summarize(windows, t)
  if (fragments.length === 0) return t("No windows set")
  return fragments.join(" · ")
}

export function generateSlots(
  windows: AvailabilityWindow[],
  t: TFn,
): string[] {
  const chips: string[] = []
  for (const day of DAYS) {
    for (const period of PERIODS) {
      if (!hasWindow(windows, period, day)) continue
      for (const time of PERIOD_TIMES[period].slots.slice(0, 2)) {
        chips.push(`${t(DAY_SHORT_KEYS[day])} ${time}`)
      }
    }
  }
  return chips
}

export async function fetchMyAvailabilityApi(): Promise<Availability> {
  const res = await authFetch("/api/users/me/availability")
  return res.json()
}

export async function updateMyAvailabilityApi(
  data: UpdateAvailabilityInput,
): Promise<Availability> {
  const res = await authFetch("/api/users/me/availability", {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  return res.json()
}

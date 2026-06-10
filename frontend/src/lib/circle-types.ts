import type { CircleType } from "@base-dashboard/shared"

// Labels double as i18n keys (English-string-as-key convention). Add matching
// entries to locales/en.json and es.json when changing these.
export const circleTypeOptions: { value: CircleType; label: string }[] = [
  { value: "who-you-are", label: "Who you are" },
  { value: "what-you-love", label: "What you love" },
  { value: "where-you-are", label: "Where you are right now" },
]

export function circleTypeLabel(type: CircleType): string {
  return circleTypeOptions.find((o) => o.value === type)?.label ?? type
}

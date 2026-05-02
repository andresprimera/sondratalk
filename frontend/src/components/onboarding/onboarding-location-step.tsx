import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TIMEZONES,
  getTimezoneByIana,
  type TimezoneEntry,
} from "@/lib/timezones"

interface OnboardingLocationStepProps {
  selectedIana: string
  onSelectIana: (iana: string) => void
  detectedIana: string
  onNext: () => void
}

export function OnboardingLocationStep({
  selectedIana,
  onSelectIana,
  detectedIana,
  onNext,
}: OnboardingLocationStepProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)

  const tz: TimezoneEntry | undefined = getTimezoneByIana(selectedIana)
  const isAutoDetected = selectedIana === detectedIana && tz !== undefined

  return (
    <section className="mt-18">
      <p className="onboarding-eyebrow mb-6">
        {t("Step {{current}} of {{total}}", { current: 1, total: 3 })}
      </p>
      <h1 className="onboarding-step-heading mb-4">{t("Where are you?")}</h1>
      <p className="onboarding-step-subline mb-10">
        {t("Your timezone helps us match you with people at the right moment.")}
      </p>

      {!isEditing && (
        <div className="onboarding-location-card mb-4">
          <MapPin className="onboarding-location-icon size-7" strokeWidth={1.5} />
          <div>
            <div className="onboarding-location-city">
              {tz ? `${tz.city}, ${tz.country}` : t("Your local timezone")}
            </div>
            <div className="onboarding-location-meta">
              {tz ? tz.label : selectedIana}
            </div>
            {isAutoDetected && (
              <span className="onboarding-location-auto">
                {t("Auto-detected")}
              </span>
            )}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="mb-4">
          <Select
            value={selectedIana}
            onValueChange={(iana) => {
              if (typeof iana !== "string") return
              onSelectIana(iana)
              setIsEditing(false)
            }}
          >
            <SelectTrigger className="h-12 w-full text-base">
              <SelectValue placeholder={t("Pick a city")} />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((entry) => (
                <SelectItem key={entry.iana} value={entry.iana}>
                  {entry.city}, {entry.country} · {entry.abbr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <button
        type="button"
        className="onboarding-change-link mb-10"
        onClick={() => {
          if (isEditing) {
            onSelectIana(detectedIana)
            setIsEditing(false)
          } else {
            setIsEditing(true)
          }
        }}
      >
        {isEditing ? t("Use detected location") : t("Change location")}
      </button>

      <div className="mt-10">
        <Button
          size="xl"
          className="landing-flicker tracking-[0.05em]"
          onClick={onNext}
        >
          {t("Looks right →")}
        </Button>
      </div>
    </section>
  )
}

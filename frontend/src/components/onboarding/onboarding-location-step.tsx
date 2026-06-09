import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  TIMEZONES,
  formatUtcOffset,
  getCountryDisplayName,
  getTimezoneEntry,
  getTimezoneLongName,
  type TimezoneEntry,
} from "@/lib/timezones"

interface OnboardingLocationStepProps {
  selectedIana: string
  onSelectIana: (iana: string) => void
  selectedCity: string
  onSelectCity: (city: string) => void
  detectedIana: string
  detectedCity: string
  onNext: () => void
  isSubmitting?: boolean
}

export function OnboardingLocationStep({
  selectedIana,
  onSelectIana,
  selectedCity,
  onSelectCity,
  detectedIana,
  detectedCity,
  onNext,
  isSubmitting,
}: OnboardingLocationStepProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [isEditing, setIsEditing] = useState(false)

  const tz: TimezoneEntry | undefined = getTimezoneEntry(selectedIana, selectedCity)
  const isAutoDetected =
    selectedIana === detectedIana && selectedCity === detectedCity && tz !== undefined

  function formatCityCountry(entry: TimezoneEntry): string {
    return `${t(entry.city)}, ${getCountryDisplayName(entry.countryCode, locale)}`
  }

  function formatTimezoneDetail(entry: TimezoneEntry): string {
    const longName = getTimezoneLongName(entry.iana, locale)
    return `${entry.abbr} · ${longName} · ${formatUtcOffset(entry.utcOffsetMinutes)}`
  }

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
              {tz ? formatCityCountry(tz) : t("Your local timezone")}
            </div>
            <div className="onboarding-location-meta">
              {tz ? formatTimezoneDetail(tz) : selectedIana}
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
          <Combobox<TimezoneEntry>
            items={TIMEZONES}
            value={tz ?? null}
            itemToStringLabel={formatCityCountry}
            isItemEqualToValue={(a, b) => a.iana === b.iana && a.city === b.city}
            onValueChange={(picked) => {
              if (!picked) return
              onSelectIana(picked.iana)
              onSelectCity(picked.city)
              setIsEditing(false)
            }}
          >
            <ComboboxInput
              placeholder={t("Pick a city")}
              className="w-full"
            />
            <ComboboxContent>
              <ComboboxList>
                <ComboboxEmpty>{t("No matches")}</ComboboxEmpty>
                <ComboboxCollection>
                  {(entry: TimezoneEntry) => (
                    <ComboboxItem key={`${entry.iana}:${entry.city}`} value={entry}>
                      {formatCityCountry(entry)} · {entry.abbr}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}

      <button
        type="button"
        className="onboarding-change-link mb-10"
        onClick={() => {
          if (isEditing) {
            onSelectIana(detectedIana)
            onSelectCity(detectedCity)
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
          disabled={isSubmitting}
        >
          {isSubmitting ? t("Saving...") : t("Looks right →")}
        </Button>
      </div>
    </section>
  )
}

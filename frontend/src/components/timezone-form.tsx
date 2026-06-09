import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldGroup } from "@/components/ui/field"
import { useAuth } from "@/hooks/use-auth"
import { updateTimezoneApi } from "@/lib/profile"
import {
  TIMEZONES,
  detectTimezone,
  formatUtcOffset,
  getCountryDisplayName,
  getTimezoneEntry,
  type TimezoneEntry,
} from "@/lib/timezones"

export function TimezoneForm() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const locale: "en" | "es" =
    i18n.language?.split("-")[0] === "es" ? "es" : "en"

  const detectedEntry = detectTimezone()
  const initialIana =
    user?.timezone ?? detectedEntry?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const initialCity = user?.city ?? detectedEntry?.city ?? ""

  const [selectedIana, setSelectedIana] = useState<string>(initialIana)
  const [selectedCity, setSelectedCity] = useState<string>(initialCity)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tz: TimezoneEntry | undefined = getTimezoneEntry(selectedIana, selectedCity)
  const isDirty =
    selectedIana !== (user?.timezone ?? null) || selectedCity !== (user?.city ?? "")

  function formatLabel(entry: TimezoneEntry): string {
    return `${t(entry.city)}, ${getCountryDisplayName(entry.countryCode, locale)} · ${entry.abbr} (${formatUtcOffset(entry.utcOffsetMinutes)})`
  }

  async function handleSave() {
    setIsSubmitting(true)
    try {
      const updated = await updateTimezoneApi({ timezone: selectedIana, city: selectedCity })
      if (user) updateUser({ ...user, timezone: updated.timezone, city: updated.city })
      toast.success(t("Saved"))
    } catch (err) {
      toast.error(
        err instanceof Error ? t(err.message) : t("Failed to save your timezone"),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Time zone")}</CardTitle>
        <CardDescription>
          {t("We use this to schedule conversations at times that fit both of you.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <Combobox<TimezoneEntry>
              items={TIMEZONES}
              value={tz ?? null}
              itemToStringLabel={formatLabel}
              isItemEqualToValue={(a, b) => a.iana === b.iana && a.city === b.city}
              onValueChange={(picked) => {
                if (!picked) return
                setSelectedIana(picked.iana)
                setSelectedCity(picked.city)
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
                        {formatLabel(entry)}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <Field>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSubmitting}
            >
              {isSubmitting ? t("Saving...") : t("Save time zone")}
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

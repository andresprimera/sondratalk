export interface TimezoneEntry {
  iana: string
  city: string
  countryCode: string
  abbr: string
  utcOffsetMinutes: number
}

interface AuthoredTimezone {
  iana: string
  city: string
  countryCode: string
}

const AUTHORED: readonly AuthoredTimezone[] = [
  // Americas
  { iana: "Pacific/Honolulu", city: "Honolulu", countryCode: "US" },
  { iana: "America/Anchorage", city: "Anchorage", countryCode: "US" },
  { iana: "America/Los_Angeles", city: "Los Angeles", countryCode: "US" },
  { iana: "America/Vancouver", city: "Vancouver", countryCode: "CA" },
  { iana: "America/Tijuana", city: "Tijuana", countryCode: "MX" },
  { iana: "America/Phoenix", city: "Phoenix", countryCode: "US" },
  { iana: "America/Denver", city: "Denver", countryCode: "US" },
  { iana: "America/Chicago", city: "Chicago", countryCode: "US" },
  { iana: "America/Mexico_City", city: "Mexico City", countryCode: "MX" },
  { iana: "America/Guatemala", city: "Guatemala City", countryCode: "GT" },
  { iana: "America/Costa_Rica", city: "San José", countryCode: "CR" },
  { iana: "America/New_York", city: "New York", countryCode: "US" },
  { iana: "America/Toronto", city: "Toronto", countryCode: "CA" },
  { iana: "America/Havana", city: "Havana", countryCode: "CU" },
  { iana: "America/Panama", city: "Panama City", countryCode: "PA" },
  { iana: "America/Bogota", city: "Bogotá", countryCode: "CO" },
  { iana: "America/Lima", city: "Lima", countryCode: "PE" },
  { iana: "America/Halifax", city: "Halifax", countryCode: "CA" },
  { iana: "America/Caracas", city: "Caracas", countryCode: "VE" },
  { iana: "America/La_Paz", city: "La Paz", countryCode: "BO" },
  { iana: "America/Santiago", city: "Santiago", countryCode: "CL" },
  { iana: "America/Asuncion", city: "Asunción", countryCode: "PY" },
  { iana: "America/Sao_Paulo", city: "São Paulo", countryCode: "BR" },
  { iana: "America/Argentina/Buenos_Aires", city: "Buenos Aires", countryCode: "AR" },
  { iana: "America/Montevideo", city: "Montevideo", countryCode: "UY" },
  { iana: "America/Puerto_Rico", city: "San Juan", countryCode: "PR" },

  // Atlantic
  { iana: "Atlantic/Azores", city: "Ponta Delgada", countryCode: "PT" },
  { iana: "Atlantic/Cape_Verde", city: "Praia", countryCode: "CV" },

  // Europe
  { iana: "Europe/London", city: "London", countryCode: "GB" },
  { iana: "Europe/Dublin", city: "Dublin", countryCode: "IE" },
  { iana: "Europe/Lisbon", city: "Lisbon", countryCode: "PT" },
  { iana: "Europe/Madrid", city: "Madrid", countryCode: "ES" },
  { iana: "Europe/Paris", city: "Paris", countryCode: "FR" },
  { iana: "Europe/Brussels", city: "Brussels", countryCode: "BE" },
  { iana: "Europe/Amsterdam", city: "Amsterdam", countryCode: "NL" },
  { iana: "Europe/Berlin", city: "Berlin", countryCode: "DE" },
  { iana: "Europe/Zurich", city: "Zurich", countryCode: "CH" },
  { iana: "Europe/Vienna", city: "Vienna", countryCode: "AT" },
  { iana: "Europe/Rome", city: "Rome", countryCode: "IT" },
  { iana: "Europe/Copenhagen", city: "Copenhagen", countryCode: "DK" },
  { iana: "Europe/Oslo", city: "Oslo", countryCode: "NO" },
  { iana: "Europe/Stockholm", city: "Stockholm", countryCode: "SE" },
  { iana: "Europe/Helsinki", city: "Helsinki", countryCode: "FI" },
  { iana: "Europe/Warsaw", city: "Warsaw", countryCode: "PL" },
  { iana: "Europe/Prague", city: "Prague", countryCode: "CZ" },
  { iana: "Europe/Budapest", city: "Budapest", countryCode: "HU" },
  { iana: "Europe/Athens", city: "Athens", countryCode: "GR" },
  { iana: "Europe/Bucharest", city: "Bucharest", countryCode: "RO" },
  { iana: "Europe/Istanbul", city: "Istanbul", countryCode: "TR" },
  { iana: "Europe/Kyiv", city: "Kyiv", countryCode: "UA" },
  { iana: "Europe/Moscow", city: "Moscow", countryCode: "RU" },

  // Africa
  { iana: "Africa/Casablanca", city: "Casablanca", countryCode: "MA" },
  { iana: "Africa/Algiers", city: "Algiers", countryCode: "DZ" },
  { iana: "Africa/Tunis", city: "Tunis", countryCode: "TN" },
  { iana: "Africa/Cairo", city: "Cairo", countryCode: "EG" },
  { iana: "Africa/Lagos", city: "Lagos", countryCode: "NG" },
  { iana: "Africa/Accra", city: "Accra", countryCode: "GH" },
  { iana: "Africa/Dakar", city: "Dakar", countryCode: "SN" },
  { iana: "Africa/Nairobi", city: "Nairobi", countryCode: "KE" },
  { iana: "Africa/Addis_Ababa", city: "Addis Ababa", countryCode: "ET" },
  { iana: "Africa/Johannesburg", city: "Johannesburg", countryCode: "ZA" },

  // Asia
  { iana: "Asia/Jerusalem", city: "Jerusalem", countryCode: "IL" },
  { iana: "Asia/Beirut", city: "Beirut", countryCode: "LB" },
  { iana: "Asia/Riyadh", city: "Riyadh", countryCode: "SA" },
  { iana: "Asia/Dubai", city: "Dubai", countryCode: "AE" },
  { iana: "Asia/Tehran", city: "Tehran", countryCode: "IR" },
  { iana: "Asia/Karachi", city: "Karachi", countryCode: "PK" },
  { iana: "Asia/Kolkata", city: "Mumbai", countryCode: "IN" },
  { iana: "Asia/Dhaka", city: "Dhaka", countryCode: "BD" },
  { iana: "Asia/Bangkok", city: "Bangkok", countryCode: "TH" },
  { iana: "Asia/Jakarta", city: "Jakarta", countryCode: "ID" },
  { iana: "Asia/Singapore", city: "Singapore", countryCode: "SG" },
  { iana: "Asia/Kuala_Lumpur", city: "Kuala Lumpur", countryCode: "MY" },
  { iana: "Asia/Manila", city: "Manila", countryCode: "PH" },
  { iana: "Asia/Hong_Kong", city: "Hong Kong", countryCode: "HK" },
  { iana: "Asia/Shanghai", city: "Shanghai", countryCode: "CN" },
  { iana: "Asia/Taipei", city: "Taipei", countryCode: "TW" },
  { iana: "Asia/Seoul", city: "Seoul", countryCode: "KR" },
  { iana: "Asia/Tokyo", city: "Tokyo", countryCode: "JP" },

  // Oceania
  { iana: "Australia/Perth", city: "Perth", countryCode: "AU" },
  { iana: "Australia/Adelaide", city: "Adelaide", countryCode: "AU" },
  { iana: "Australia/Brisbane", city: "Brisbane", countryCode: "AU" },
  { iana: "Australia/Sydney", city: "Sydney", countryCode: "AU" },
  { iana: "Pacific/Auckland", city: "Auckland", countryCode: "NZ" },
  { iana: "Pacific/Fiji", city: "Suva", countryCode: "FJ" },
]

function findPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((p) => p.type === type)
  return part ? part.value : ""
}

function getShortAbbr(iana: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    timeZoneName: "short",
  }).formatToParts(now)
  return findPart(parts, "timeZoneName")
}

function getOffsetMinutes(iana: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    timeZoneName: "longOffset",
  }).formatToParts(now)
  const raw = findPart(parts, "timeZoneName")
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const sign = match[1] === "-" ? -1 : 1
  const hours = Number(match[2])
  const minutes = match[3] ? Number(match[3]) : 0
  return sign * (hours * 60 + minutes)
}

const NOW = new Date()

export const TIMEZONES: readonly TimezoneEntry[] = AUTHORED.map((entry) => ({
  iana: entry.iana,
  city: entry.city,
  countryCode: entry.countryCode,
  abbr: getShortAbbr(entry.iana, NOW),
  utcOffsetMinutes: getOffsetMinutes(entry.iana, NOW),
})).sort((a, b) => a.utcOffsetMinutes - b.utcOffsetMinutes)

const TIMEZONES_BY_IANA = new Map(TIMEZONES.map((t) => [t.iana, t]))

export function getTimezoneByIana(iana: string): TimezoneEntry | undefined {
  return TIMEZONES_BY_IANA.get(iana)
}

export function detectTimezone(): TimezoneEntry | undefined {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone
  return getTimezoneByIana(iana)
}

export function getCountryDisplayName(countryCode: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" })
    return dn.of(countryCode) ?? countryCode
  } catch {
    return countryCode
  }
}

export function getTimezoneLongName(iana: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: iana,
    timeZoneName: "long",
  }).formatToParts(new Date())
  return findPart(parts, "timeZoneName")
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`
}

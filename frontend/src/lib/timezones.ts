export interface TimezoneEntry {
  iana: string
  city: string
  country: string
  abbr: string
  utcOffsetMinutes: number
  label: string
}

interface AuthoredTimezone {
  iana: string
  city: string
  country: string
}

const AUTHORED: readonly AuthoredTimezone[] = [
  // Americas
  { iana: "Pacific/Honolulu", city: "Honolulu", country: "United States" },
  { iana: "America/Anchorage", city: "Anchorage", country: "United States" },
  { iana: "America/Los_Angeles", city: "Los Angeles", country: "United States" },
  { iana: "America/Vancouver", city: "Vancouver", country: "Canada" },
  { iana: "America/Tijuana", city: "Tijuana", country: "Mexico" },
  { iana: "America/Phoenix", city: "Phoenix", country: "United States" },
  { iana: "America/Denver", city: "Denver", country: "United States" },
  { iana: "America/Chicago", city: "Chicago", country: "United States" },
  { iana: "America/Mexico_City", city: "Mexico City", country: "Mexico" },
  { iana: "America/Guatemala", city: "Guatemala City", country: "Guatemala" },
  { iana: "America/Costa_Rica", city: "San José", country: "Costa Rica" },
  { iana: "America/New_York", city: "New York", country: "United States" },
  { iana: "America/Toronto", city: "Toronto", country: "Canada" },
  { iana: "America/Havana", city: "Havana", country: "Cuba" },
  { iana: "America/Panama", city: "Panama City", country: "Panama" },
  { iana: "America/Bogota", city: "Bogotá", country: "Colombia" },
  { iana: "America/Lima", city: "Lima", country: "Peru" },
  { iana: "America/Halifax", city: "Halifax", country: "Canada" },
  { iana: "America/Caracas", city: "Caracas", country: "Venezuela" },
  { iana: "America/La_Paz", city: "La Paz", country: "Bolivia" },
  { iana: "America/Santiago", city: "Santiago", country: "Chile" },
  { iana: "America/Asuncion", city: "Asunción", country: "Paraguay" },
  { iana: "America/Sao_Paulo", city: "São Paulo", country: "Brazil" },
  { iana: "America/Argentina/Buenos_Aires", city: "Buenos Aires", country: "Argentina" },
  { iana: "America/Montevideo", city: "Montevideo", country: "Uruguay" },
  { iana: "America/Puerto_Rico", city: "San Juan", country: "Puerto Rico" },

  // Atlantic
  { iana: "Atlantic/Azores", city: "Ponta Delgada", country: "Portugal" },
  { iana: "Atlantic/Cape_Verde", city: "Praia", country: "Cape Verde" },

  // Europe
  { iana: "Europe/London", city: "London", country: "United Kingdom" },
  { iana: "Europe/Dublin", city: "Dublin", country: "Ireland" },
  { iana: "Europe/Lisbon", city: "Lisbon", country: "Portugal" },
  { iana: "Europe/Madrid", city: "Madrid", country: "Spain" },
  { iana: "Europe/Paris", city: "Paris", country: "France" },
  { iana: "Europe/Brussels", city: "Brussels", country: "Belgium" },
  { iana: "Europe/Amsterdam", city: "Amsterdam", country: "Netherlands" },
  { iana: "Europe/Berlin", city: "Berlin", country: "Germany" },
  { iana: "Europe/Zurich", city: "Zurich", country: "Switzerland" },
  { iana: "Europe/Vienna", city: "Vienna", country: "Austria" },
  { iana: "Europe/Rome", city: "Rome", country: "Italy" },
  { iana: "Europe/Copenhagen", city: "Copenhagen", country: "Denmark" },
  { iana: "Europe/Oslo", city: "Oslo", country: "Norway" },
  { iana: "Europe/Stockholm", city: "Stockholm", country: "Sweden" },
  { iana: "Europe/Helsinki", city: "Helsinki", country: "Finland" },
  { iana: "Europe/Warsaw", city: "Warsaw", country: "Poland" },
  { iana: "Europe/Prague", city: "Prague", country: "Czech Republic" },
  { iana: "Europe/Budapest", city: "Budapest", country: "Hungary" },
  { iana: "Europe/Athens", city: "Athens", country: "Greece" },
  { iana: "Europe/Bucharest", city: "Bucharest", country: "Romania" },
  { iana: "Europe/Istanbul", city: "Istanbul", country: "Turkey" },
  { iana: "Europe/Kyiv", city: "Kyiv", country: "Ukraine" },
  { iana: "Europe/Moscow", city: "Moscow", country: "Russia" },

  // Africa
  { iana: "Africa/Casablanca", city: "Casablanca", country: "Morocco" },
  { iana: "Africa/Algiers", city: "Algiers", country: "Algeria" },
  { iana: "Africa/Tunis", city: "Tunis", country: "Tunisia" },
  { iana: "Africa/Cairo", city: "Cairo", country: "Egypt" },
  { iana: "Africa/Lagos", city: "Lagos", country: "Nigeria" },
  { iana: "Africa/Accra", city: "Accra", country: "Ghana" },
  { iana: "Africa/Dakar", city: "Dakar", country: "Senegal" },
  { iana: "Africa/Nairobi", city: "Nairobi", country: "Kenya" },
  { iana: "Africa/Addis_Ababa", city: "Addis Ababa", country: "Ethiopia" },
  { iana: "Africa/Johannesburg", city: "Johannesburg", country: "South Africa" },

  // Asia
  { iana: "Asia/Jerusalem", city: "Jerusalem", country: "Israel" },
  { iana: "Asia/Beirut", city: "Beirut", country: "Lebanon" },
  { iana: "Asia/Riyadh", city: "Riyadh", country: "Saudi Arabia" },
  { iana: "Asia/Dubai", city: "Dubai", country: "United Arab Emirates" },
  { iana: "Asia/Tehran", city: "Tehran", country: "Iran" },
  { iana: "Asia/Karachi", city: "Karachi", country: "Pakistan" },
  { iana: "Asia/Kolkata", city: "Mumbai", country: "India" },
  { iana: "Asia/Dhaka", city: "Dhaka", country: "Bangladesh" },
  { iana: "Asia/Bangkok", city: "Bangkok", country: "Thailand" },
  { iana: "Asia/Jakarta", city: "Jakarta", country: "Indonesia" },
  { iana: "Asia/Singapore", city: "Singapore", country: "Singapore" },
  { iana: "Asia/Kuala_Lumpur", city: "Kuala Lumpur", country: "Malaysia" },
  { iana: "Asia/Manila", city: "Manila", country: "Philippines" },
  { iana: "Asia/Hong_Kong", city: "Hong Kong", country: "Hong Kong" },
  { iana: "Asia/Shanghai", city: "Shanghai", country: "China" },
  { iana: "Asia/Taipei", city: "Taipei", country: "Taiwan" },
  { iana: "Asia/Seoul", city: "Seoul", country: "South Korea" },
  { iana: "Asia/Tokyo", city: "Tokyo", country: "Japan" },

  // Oceania
  { iana: "Australia/Perth", city: "Perth", country: "Australia" },
  { iana: "Australia/Adelaide", city: "Adelaide", country: "Australia" },
  { iana: "Australia/Brisbane", city: "Brisbane", country: "Australia" },
  { iana: "Australia/Sydney", city: "Sydney", country: "Australia" },
  { iana: "Pacific/Auckland", city: "Auckland", country: "New Zealand" },
  { iana: "Pacific/Fiji", city: "Suva", country: "Fiji" },
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

function getLongName(iana: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    timeZoneName: "long",
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

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-"
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`
}

const NOW = new Date()

export const TIMEZONES: readonly TimezoneEntry[] = AUTHORED.map((entry) => {
  const abbr = getShortAbbr(entry.iana, NOW)
  const longName = getLongName(entry.iana, NOW)
  const utcOffsetMinutes = getOffsetMinutes(entry.iana, NOW)
  const offsetLabel = formatOffset(utcOffsetMinutes)
  const label = `${abbr} · ${longName} · ${offsetLabel}`
  return {
    iana: entry.iana,
    city: entry.city,
    country: entry.country,
    abbr,
    utcOffsetMinutes,
    label,
  }
}).sort((a, b) => a.utcOffsetMinutes - b.utcOffsetMinutes)

const TIMEZONES_BY_IANA = new Map(TIMEZONES.map((t) => [t.iana, t]))

export function getTimezoneByIana(iana: string): TimezoneEntry | undefined {
  return TIMEZONES_BY_IANA.get(iana)
}

export function detectTimezone(): TimezoneEntry | undefined {
  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone
  return getTimezoneByIana(iana)
}

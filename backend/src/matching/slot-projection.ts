import {
  PERIOD_SLOTS,
  type AvailabilityWindow,
  type Day,
} from '@base-dashboard/shared';

const HORIZON_DAYS = 7;
const MAX_SLOTS = 6;

const WEEKDAY_TO_DAY: Record<string, Day> = {
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
  sun: 'sun',
};

function weekdayKey(raw: string): string {
  return raw.replace(/[^A-Za-z]/g, '').slice(0, 3).toLowerCase();
}

export interface ProjectSlotsArgs {
  windows: AvailabilityWindow[];
  candidateTz: string;
  requesterTz: string;
  now: Date;
  horizonDays?: number;
  maxSlots?: number;
}

export interface ProjectedSlotInternal {
  startsAt: string;
  requesterDate: string;
  requesterTime: string;
}

export function projectSlotsForCandidate(
  args: ProjectSlotsArgs,
): ProjectedSlotInternal[] {
  if (args.windows.length === 0) return [];
  const horizonDays = args.horizonDays ?? HORIZON_DAYS;
  const maxSlots = args.maxSlots ?? MAX_SLOTS;

  const windowsByDay = new Map<Day, AvailabilityWindow[]>();
  for (const w of args.windows) {
    const list = windowsByDay.get(w.day) ?? [];
    list.push(w);
    windowsByDay.set(w.day, list);
  }

  const candidateDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: args.candidateTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  const requesterDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: args.requesterTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const requesterTimeFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: args.requesterTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const nowMs = args.now.getTime();
  const dayMs = 86_400_000;
  const out: ProjectedSlotInternal[] = [];

  for (let offset = 0; offset < horizonDays; offset++) {
    const probe = new Date(nowMs + offset * dayMs);
    const parts = parseCandidateParts(candidateDateFmt, probe);
    if (!parts) continue;
    const day = WEEKDAY_TO_DAY[weekdayKey(parts.weekday)];
    if (!day) continue;
    const matches = windowsByDay.get(day);
    if (!matches) continue;

    for (const window of matches) {
      for (const time of PERIOD_SLOTS[window.period]) {
        const [hh, mm] = time.split(':').map((s) => Number(s));
        const utc = wallClockToUtc(
          {
            y: parts.year,
            mo: parts.month,
            d: parts.day,
            h: hh,
            mi: mm,
          },
          args.candidateTz,
        );
        if (utc.getTime() <= nowMs) continue;
        out.push({
          startsAt: utc.toISOString(),
          requesterDate: formatYmd(requesterDateFmt, utc),
          requesterTime: formatHm(requesterTimeFmt, utc),
        });
      }
    }
  }

  out.sort((a, b) =>
    a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
  );

  const seen = new Set<string>();
  const deduped: ProjectedSlotInternal[] = [];
  for (const slot of out) {
    if (seen.has(slot.startsAt)) continue;
    seen.add(slot.startsAt);
    deduped.push(slot);
    if (deduped.length >= maxSlots) break;
  }
  return deduped;
}

interface CandidateParts {
  year: number;
  month: number;
  day: number;
  weekday: string;
}

function parseCandidateParts(
  fmt: Intl.DateTimeFormat,
  date: Date,
): CandidateParts | null {
  const parts = fmt.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let weekday = '';
  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'month') month = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'weekday') weekday = p.value;
  }
  if (!year || !month || !day || !weekday) return null;
  return { year, month, day, weekday };
}

function formatYmd(fmt: Intl.DateTimeFormat, date: Date): string {
  const parts = fmt.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    else if (p.type === 'month') month = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function formatHm(fmt: Intl.DateTimeFormat, date: Date): string {
  const parts = fmt.formatToParts(date);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value);
    else if (p.type === 'minute') minute = Number(p.value);
  }
  // Some locales emit hour '24' for midnight; normalize.
  if (hour === 24) hour = 0;
  return `${pad(hour, 2)}:${pad(minute, 2)}`;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

interface WallClockParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

function wallClockToUtc(parts: WallClockParts, tz: string): Date {
  const guess = new Date(
    Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi),
  );
  const offset1 = computeOffsetMinutes(guess, tz);
  let candidate = new Date(guess.getTime() - offset1 * 60_000);
  const offset2 = computeOffsetMinutes(candidate, tz);
  if (offset2 !== offset1) {
    candidate = new Date(guess.getTime() - offset2 * 60_000);
  }
  return candidate;
}

function computeOffsetMinutes(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(date);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  if (!tzPart) return 0;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tzPart.value);
  if (!m) return 0;
  const sign = m[1] === '+' ? 1 : -1;
  const hours = Number(m[2]);
  const minutes = m[3] ? Number(m[3]) : 0;
  return sign * (hours * 60 + minutes);
}

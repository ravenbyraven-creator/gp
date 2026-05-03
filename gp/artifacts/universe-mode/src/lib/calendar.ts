import type { Show } from "@workspace/api-client-react";

export type UniverseDate = {
  year: number;
  month: number;
  week: number;
  day: number;
};

export type PremiumEvent = {
  id: string;
  name: string;
  month: number;
  week: number;
  day: number;
  /** Universe year this event belongs to. When set, the event is year-scoped (no auto-repeat).
   *  When absent, legacy repeating behaviour is used. */
  year?: number;
  notes?: string;
  imageUrl?: string;
};

export const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const DAY_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

export const DEFAULT_UNIVERSE_DATE: UniverseDate = {
  year: 0,
  month: 1,
  week: 1,
  day: 1,
};

const DAYS_PER_WEEK = 7;
const WEEKS_PER_MONTH = 4;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = WEEKS_PER_MONTH * DAYS_PER_WEEK;
const DAYS_PER_YEAR = MONTHS_PER_YEAR * DAYS_PER_MONTH;

/**
 * Convert a UniverseDate to an absolute "days since universe start" integer.
 */
export function dateToInt(date: { year?: number; month: number; week: number; day: number }): number {
  const year = date.year ?? 0;
  return (
    year * DAYS_PER_YEAR +
    (date.month - 1) * DAYS_PER_MONTH +
    (date.week - 1) * DAYS_PER_WEEK +
    date.day
  );
}

/**
 * Convert an integer (days since universe start) back to a UniverseDate.
 */
export function intToDate(n: number): UniverseDate {
  let abs = n;
  const year = Math.floor(abs / DAYS_PER_YEAR);
  abs -= year * DAYS_PER_YEAR;
  const month = Math.floor(abs / DAYS_PER_MONTH) + 1;
  abs -= (month - 1) * DAYS_PER_MONTH;
  const week = Math.floor(abs / DAYS_PER_WEEK) + 1;
  abs -= (week - 1) * DAYS_PER_WEEK;
  const day = abs;
  return { year, month, week, day };
}

/**
 * Stable per-week identifier ("y-m-w") used to detect when the universe
 * has crossed into a new calendar week.
 */
export function weekKey(date: { year?: number; month: number; week: number }): string {
  const year = date.year ?? 0;
  return `${year}-${date.month}-${date.week}`;
}

/**
 * Display format: "MAY · WEEK 2 · MONDAY"
 */
export function formatDate(date: { month: number; week: number; day: number }): string {
  return `${MONTH_LABELS[date.month - 1]} · WEEK ${date.week} · ${DAY_FULL[date.day].toUpperCase()}`;
}

/**
 * Compact format: "MAY WEEK 4 SATURDAY"
 */
export function formatDateCompact(date: { month: number; week: number; day: number }): string {
  return `${MONTH_LABELS[date.month - 1]} WEEK ${date.week} ${DAY_FULL[date.day].toUpperCase()}`;
}

const NIGHT_TO_DAY: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Convert a Show.night string to a day index (0-6), or null if unset.
 */
export function nightToDay(night: string | undefined): number | null {
  if (!night) return null;
  return NIGHT_TO_DAY[night] ?? null;
}

/**
 * Find the next "thing to book" — either the next show night or the next
 * premium event, whichever comes first after `currentDate`.
 * Returns the new date, or null if there is nothing scheduled.
 */
export function advanceToNextShow(
  currentDate: UniverseDate,
  shows: Show[],
  events: PremiumEvent[],
): UniverseDate | null {
  const currentInt = dateToInt(currentDate);

  const candidates: number[] = [];

  // For each show with a night assigned, find the next occurrence after current.
  for (const show of shows) {
    const dayIdx = nightToDay(show.night);
    if (dayIdx === null) continue;

    // B-05 fix: the answer is always within 7 days (one full week). The old
    // bound of DAYS_PER_YEAR (365) was up to 52× more work than needed.
    for (let offset = 1; offset <= DAYS_PER_WEEK; offset++) {
      const candidateInt = currentInt + offset;
      const candidate = intToDate(candidateInt);
      if (candidate.day === dayIdx) {
        candidates.push(candidateInt);
        break;
      }
    }
  }

  // For premium events: year-aware events use exact date; legacy events project to this/next year.
  for (const event of events) {
    if (event.year !== undefined) {
      const eventInt = dateToInt({ year: event.year, month: event.month, week: event.week, day: event.day });
      if (eventInt > currentInt) candidates.push(eventInt);
    } else {
      const thisYearInt = dateToInt({
        year: currentDate.year,
        month: event.month,
        week: event.week,
        day: event.day,
      });
      if (thisYearInt > currentInt) {
        candidates.push(thisYearInt);
      } else {
        const nextYearInt = dateToInt({
          year: currentDate.year + 1,
          month: event.month,
          week: event.week,
          day: event.day,
        });
        candidates.push(nextYearInt);
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a - b);
  return intToDate(candidates[0]);
}

/**
 * Find the next show night after currentDate (events ignored). Returns the
 * Show plus the date it falls on, or null if no shows have a night assigned.
 */
export function nextShowNight(
  currentDate: UniverseDate,
  shows: Show[],
): { show: Show; date: UniverseDate } | null {
  const currentInt = dateToInt(currentDate);
  let best: { show: Show; date: UniverseDate; int: number } | null = null;

  for (const show of shows) {
    const dayIdx = nightToDay(show.night);
    if (dayIdx === null) continue;

    // B-05 fix: same as advanceToNextShow — cap at 7 (one full week).
    for (let offset = 1; offset <= DAYS_PER_WEEK; offset++) {
      const candidateInt = currentInt + offset;
      const candidate = intToDate(candidateInt);
      if (candidate.day === dayIdx) {
        if (!best || candidateInt < best.int) {
          best = { show, date: candidate, int: candidateInt };
        }
        break;
      }
    }
  }

  if (!best) return null;
  return { show: best.show, date: best.date };
}

/**
 * Days difference from currentDate to eventDate.
 * Year-aware events use their stored year directly.
 * Legacy (no year) events project to this year or next.
 */
export function daysUntil(
  eventDate: { month: number; week: number; day: number; year?: number },
  currentDate: UniverseDate,
): number {
  const currentInt = dateToInt(currentDate);
  if (eventDate.year !== undefined) {
    const eventInt = dateToInt({ year: eventDate.year, month: eventDate.month, week: eventDate.week, day: eventDate.day });
    return Math.max(0, eventInt - currentInt);
  }
  const thisYearInt = dateToInt({
    year: currentDate.year,
    month: eventDate.month,
    week: eventDate.week,
    day: eventDate.day,
  });
  const projectedInt =
    thisYearInt >= currentInt
      ? thisYearInt
      : dateToInt({
          year: currentDate.year + 1,
          month: eventDate.month,
          week: eventDate.week,
          day: eventDate.day,
        });
  return projectedInt - currentInt;
}

/**
 * Number of weeks (rounded down, minimum 0) between currentDate and an event.
 * Year-aware events use their stored year. Legacy events project to this/next year.
 */
export function weeksUntil(
  eventDate: { month: number; week: number; day: number; year?: number },
  currentDate: UniverseDate,
): number {
  const diffDays = daysUntil(eventDate, currentDate);
  return Math.max(0, Math.floor(diffDays / DAYS_PER_WEEK));
}

/**
 * Sort and filter events to those still upcoming (relative to currentDate).
 * Year-aware events are included only if their exact date >= currentDate.
 * Legacy events are always included (projected to future).
 */
export function upcomingEvents(
  events: PremiumEvent[],
  currentDate: UniverseDate,
): PremiumEvent[] {
  const currentInt = dateToInt(currentDate);
  const future = events.filter((e) => {
    if (e.year !== undefined) {
      const eventInt = dateToInt({ year: e.year, month: e.month, week: e.week, day: e.day });
      return eventInt >= currentInt;
    }
    return true;
  });
  return [...future].sort((a, b) => daysUntil(a, currentDate) - daysUntil(b, currentDate));
}

/**
 * Filter out events whose date has been passed by newDate.
 * Year-aware events compare directly. Legacy events use old projection logic.
 */
export function archivePastEvents(
  events: PremiumEvent[],
  previousDate: UniverseDate,
  newDate: UniverseDate,
): PremiumEvent[] {
  const newInt = dateToInt(newDate);
  return events.filter((e) => {
    if (e.year !== undefined) {
      const eventInt = dateToInt({ year: e.year, month: e.month, week: e.week, day: e.day });
      return eventInt > newInt;
    }
    // Legacy projection logic
    const prevInt = dateToInt(previousDate);
    const candidates = [
      dateToInt({ year: previousDate.year, month: e.month, week: e.week, day: e.day }),
      dateToInt({ year: previousDate.year + 1, month: e.month, week: e.week, day: e.day }),
    ];
    const projected = candidates.find((c) => c >= prevInt) ?? candidates[0];
    return projected > newInt;
  });
}

// ── Season utilities ───────────────────────────────────────────────────────

/**
 * Returns the 12 months of a season in order, starting from startMonth.
 * e.g. startMonth=4 → [4,5,6,7,8,9,10,11,12,1,2,3]
 */
export function seasonMonths(startMonth: number): number[] {
  const months: number[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(((startMonth - 1 + i) % 12) + 1);
  }
  return months;
}

/**
 * Returns the "season year" for a given universe date.
 * If season starts in April (month 4): months 4-12 → same year, months 1-3 → year-1.
 * If season starts in January (month 1): always returns date.year (full-year seasons).
 */
export function seasonYearOf(date: UniverseDate, startMonth: number): number {
  if (startMonth === 1) return date.year;
  return date.month >= startMonth ? date.year : date.year - 1;
}

/**
 * Returns the ordered list of { month, year } universe coordinates for a season.
 * seasonYear is the return value of seasonYearOf().
 */
export function currentSeasonDateRange(
  seasonYear: number,
  startMonth: number,
): Array<{ month: number; year: number }> {
  const months = seasonMonths(startMonth);
  return months.map((m) => {
    const year = startMonth > 1 && m < startMonth ? seasonYear + 1 : seasonYear;
    return { month: m, year };
  });
}

/**
 * Returns the { month, year } of the last month in a season.
 */
export function seasonEndMonthYear(
  seasonYear: number,
  startMonth: number,
): { month: number; year: number } {
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? seasonYear : seasonYear + 1;
  return { month: endMonth, year: endYear };
}

/**
 * Returns true if the given universe date falls inside the season
 * defined by [seasonYear, startMonth].
 */
export function isInSeason(
  date: UniverseDate,
  seasonYear: number,
  startMonth: number,
): boolean {
  return seasonYearOf(date, startMonth) === seasonYear;
}

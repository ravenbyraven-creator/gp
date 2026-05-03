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
  notes?: string;
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

    // Look forward up to 8 weeks to be safe.
    for (let offset = 1; offset <= DAYS_PER_YEAR; offset++) {
      const candidateInt = currentInt + offset;
      const candidate = intToDate(candidateInt);
      if (candidate.day === dayIdx) {
        candidates.push(candidateInt);
        break;
      }
    }
  }

  // For each premium event, project to the same year as currentDate and
  // pick the next occurrence (this year or next year).
  for (const event of events) {
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

    for (let offset = 1; offset <= DAYS_PER_YEAR; offset++) {
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
 * Number of weeks (rounded down to nearest week, minimum 0) between
 * currentDate and an eventDate. Computed against this-year-or-next-year
 * projection of the event so it never returns a negative number.
 */
export function weeksUntil(
  eventDate: { month: number; week: number; day: number },
  currentDate: UniverseDate,
): number {
  const currentInt = dateToInt(currentDate);
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
  const diffDays = projectedInt - currentInt;
  return Math.max(0, Math.floor(diffDays / DAYS_PER_WEEK));
}

/**
 * Days difference, projecting event to this year or next.
 */
export function daysUntil(
  eventDate: { month: number; week: number; day: number },
  currentDate: UniverseDate,
): number {
  const currentInt = dateToInt(currentDate);
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
 * Sort and filter events to those still upcoming (relative to currentDate).
 * "Past" means strictly before currentDate (same-day events are still upcoming
 * until the user advances past them).
 */
export function upcomingEvents(
  events: PremiumEvent[],
  currentDate: UniverseDate,
): PremiumEvent[] {
  const currentInt = dateToInt(currentDate);
  const futureOnly = events.filter((e) => {
    const eventInt = dateToInt({
      year: currentDate.year,
      month: e.month,
      week: e.week,
      day: e.day,
    });
    if (eventInt >= currentInt) return true;
    // wraps to next year — still future
    return true;
  });
  return [...futureOnly].sort((a, b) => {
    const aDays = daysUntil(a, currentDate);
    const bDays = daysUntil(b, currentDate);
    return aDays - bDays;
  });
}

/**
 * Filter out events whose date has been passed by currentDate.
 * Used to auto-archive events when advancing the universe.
 *
 * "Passed" means strictly before currentDate (same-day events are kept so
 * the AI still treats the day-of as the upcoming PPV).
 */
export function archivePastEvents(
  events: PremiumEvent[],
  previousDate: UniverseDate,
  newDate: UniverseDate,
): PremiumEvent[] {
  const newInt = dateToInt(newDate);
  return events.filter((e) => {
    // Project the event into the previous year-or-this-year window so we
    // can tell if `newDate` has now passed it.
    const candidates = [
      dateToInt({ year: previousDate.year, month: e.month, week: e.week, day: e.day }),
      dateToInt({ year: previousDate.year + 1, month: e.month, week: e.week, day: e.day }),
    ];
    // Pick the nearest projection that was >= previousDate.
    const prevInt = dateToInt(previousDate);
    const projected = candidates.find((c) => c >= prevInt) ?? candidates[0];
    return projected > newInt;
  });
}

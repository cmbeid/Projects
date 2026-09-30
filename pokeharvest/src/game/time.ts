/** The clock: minutes since midnight, running from 6:00 to 2:00 the next morning. */
export const DAY_START = 6 * 60;
/** 2:00 the next morning: anyone still up passes out. */
export const DAY_END = 26 * 60;
/** Real seconds per in-game minute. A whole day is 14 minutes. */
export const SECONDS_PER_MINUTE = 0.7;
export const DAYS_PER_SEASON = 28;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

export function seasonOf(day: number): (typeof SEASONS)[number] {
  return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length]!;
}

/** Day of the season, 1–28. */
export function dayOfSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}

/** Year, from 1. */
export function yearOf(day: number): number {
  return Math.floor((day - 1) / (DAYS_PER_SEASON * SEASONS.length)) + 1;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export function weekdayOf(day: number): string {
  return WEEKDAYS[(day - 1) % 7]!;
}

/** "6:30 AM" style. */
export function clockText(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  const hour = Math.floor(m / 60);
  const mins = Math.floor((m % 60) / 10) * 10;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

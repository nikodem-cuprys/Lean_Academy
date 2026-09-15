// Tiny shared home for the UTC-week helper both apps/web/src/lib/
// achievements.ts and apps/web/src/lib/weekly-challenges.ts need —
// pulled out to its own leaf module so those two can both depend on it
// without importing from each other. Same UTC-calendar simplification
// apps/web/src/lib/streak.ts already documents for days (no per-user
// timezone field yet on User).

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `now`. getUTCDay(): 0=Sun..6=Sat. */
export function startOfUtcWeek(now: Date): Date {
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const utcMidnightToday = Math.floor(now.getTime() / MS_PER_DAY) * MS_PER_DAY;
  return new Date(utcMidnightToday - daysSinceMonday * MS_PER_DAY);
}

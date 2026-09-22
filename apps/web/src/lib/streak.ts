import { prisma } from "@lean-academy/db";
import { startOfUtcWeek } from "@/lib/date-utils";

// Streaks epic (Phase 5 — see docs/kanban.md). Called once per completed
// TrainingSession from /api/training-sessions/[id]/complete.
//
// Day-boundary rule (v0 simplification, documented per that card's
// acceptance criteria rather than left implicit): User has no timezone
// field yet, so "day" here means UTC calendar day for every user
// regardless of where they actually live. This can misjudge a streak
// near midnight for users far from UTC — acceptable for v0, revisit once
// User carries a real timezone.
//
// Streak protection: a genuine mechanic, not just "don't punish
// missing a day" copy. Streak.streakFreezesAvailable starts at 1 (a new
// streak is protected from day one) and is re-earned, capped at 2, every
// 7 consecutive active days. Missing exactly one day consumes a freeze
// and keeps the streak alive; missing two or more days (or missing one
// with no freeze left) resets it. This mirrors the "reasonable streak
// protection" project_prompt.txt asks for without being unlimited.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FREEZE_CAP = 2;
const FREEZE_EARN_INTERVAL_DAYS = 7;

function utcDayNumber(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export type StreakOutcome = {
  currentStreakDays: number;
  longestStreakDays: number;
  streakFreezesAvailable: number;
  usedFreeze: boolean;
  streakBroken: boolean;
};

export async function recordActiveDayForStreak(userId: string, now: Date = new Date()): Promise<StreakOutcome> {
  const today = utcDayNumber(now);

  const existing = await prisma.streak.findUnique({ where: { userId } });

  if (!existing || existing.lastActiveDate === null) {
    const result = await prisma.streak.upsert({
      where: { userId },
      create: { userId, currentStreakDays: 1, longestStreakDays: 1, lastActiveDate: now, streakFreezesAvailable: 1 },
      update: { currentStreakDays: 1, longestStreakDays: Math.max(existing?.longestStreakDays ?? 0, 1), lastActiveDate: now },
    });
    return {
      currentStreakDays: result.currentStreakDays,
      longestStreakDays: result.longestStreakDays,
      streakFreezesAvailable: result.streakFreezesAvailable,
      usedFreeze: false,
      streakBroken: false,
    };
  }

  const lastDay = utcDayNumber(existing.lastActiveDate);
  const gapDays = today - lastDay;

  if (gapDays <= 0) {
    // Already recorded active today (a second session same day) — no-op.
    return {
      currentStreakDays: existing.currentStreakDays,
      longestStreakDays: existing.longestStreakDays,
      streakFreezesAvailable: existing.streakFreezesAvailable,
      usedFreeze: false,
      streakBroken: false,
    };
  }

  if (gapDays === 1) {
    const nextStreak = existing.currentStreakDays + 1;
    const earnsFreeze = nextStreak % FREEZE_EARN_INTERVAL_DAYS === 0;
    const nextFreezes = earnsFreeze
      ? Math.min(FREEZE_CAP, existing.streakFreezesAvailable + 1)
      : existing.streakFreezesAvailable;
    const result = await prisma.streak.update({
      where: { userId },
      data: {
        currentStreakDays: nextStreak,
        longestStreakDays: Math.max(existing.longestStreakDays, nextStreak),
        lastActiveDate: now,
        streakFreezesAvailable: nextFreezes,
      },
    });
    return {
      currentStreakDays: result.currentStreakDays,
      longestStreakDays: result.longestStreakDays,
      streakFreezesAvailable: result.streakFreezesAvailable,
      usedFreeze: false,
      streakBroken: false,
    };
  }

  if (gapDays === 2 && existing.streakFreezesAvailable > 0) {
    // Exactly one day missed, and a freeze is available: bridge it.
    const nextStreak = existing.currentStreakDays + 1;
    const result = await prisma.streak.update({
      where: { userId },
      data: {
        currentStreakDays: nextStreak,
        longestStreakDays: Math.max(existing.longestStreakDays, nextStreak),
        lastActiveDate: now,
        streakFreezesAvailable: existing.streakFreezesAvailable - 1,
      },
    });
    return {
      currentStreakDays: result.currentStreakDays,
      longestStreakDays: result.longestStreakDays,
      streakFreezesAvailable: result.streakFreezesAvailable,
      usedFreeze: true,
      streakBroken: false,
    };
  }

  // Two or more days missed with no freeze to cover it: streak resets.
  const result = await prisma.streak.update({
    where: { userId },
    data: {
      currentStreakDays: 1,
      lastActiveDate: now,
    },
  });
  return {
    currentStreakDays: result.currentStreakDays,
    longestStreakDays: result.longestStreakDays,
    streakFreezesAvailable: result.streakFreezesAvailable,
    usedFreeze: false,
    streakBroken: true,
  };
}

export type StreakStatus = {
  currentStreakDays: number;
  longestStreakDays: number;
  trainedToday: boolean;
  daysSinceLastActive: number | null;
};

export async function getStreakStatus(userId: string, now: Date = new Date()): Promise<StreakStatus | null> {
  const streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak || streak.currentStreakDays === 0) return null;

  const today = utcDayNumber(now);
  const lastDay = streak.lastActiveDate ? utcDayNumber(streak.lastActiveDate) : null;
  const daysSinceLastActive = lastDay === null ? null : today - lastDay;

  return {
    currentStreakDays: streak.currentStreakDays,
    longestStreakDays: streak.longestStreakDays,
    trainedToday: daysSinceLastActive === 0,
    daysSinceLastActive,
  };
}

export interface WeeklyActivityDay {
  /** 0 = Monday .. 6 = Sunday, matching startOfUtcWeek's own boundary. */
  dayOfWeek: number;
  trained: boolean;
  isToday: boolean;
}

/**
 * Real per-day training activity for the current UTC week (Monday
 * start, same boundary weekly-challenges.ts/achievements.ts already
 * use), for the desktop dashboard's "This week" strip — genuinely
 * derived from real TrainingSession.completedAt rows, never a
 * fabricated pattern. Only returns days up to and including today
 * (not the full 7), since a day that hasn't happened yet isn't
 * meaningfully "missed."
 */
export async function getWeeklyActivity(userId: string, now: Date = new Date()): Promise<WeeklyActivityDay[]> {
  const weekStart = startOfUtcWeek(now);
  const todayIndex = utcDayNumber(now) - utcDayNumber(weekStart);

  const sessions = await prisma.trainingSession.findMany({
    where: { userId, status: "COMPLETED", completedAt: { gte: weekStart } },
    select: { completedAt: true },
  });
  const trainedDayIndices = new Set(
    sessions
      .filter((s) => s.completedAt)
      .map((s) => utcDayNumber(s.completedAt as Date) - utcDayNumber(weekStart))
  );

  return Array.from({ length: Math.min(todayIndex + 1, 7) }, (_, dayOfWeek) => ({
    dayOfWeek,
    trained: trainedDayIndices.has(dayOfWeek),
    isToday: dayOfWeek === todayIndex,
  }));
}

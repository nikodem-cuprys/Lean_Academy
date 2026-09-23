import { prisma, Prisma } from "@lean-academy/db";
import { startOfUtcDay, MS_PER_DAY } from "@/lib/date-utils";

// Daily Quests — the "quest line" half of the Duolingo-style engagement
// request (see docs/kanban.md's Gamification epic). Same real
// rotation/generation pattern apps/web/src/lib/weekly-challenges.ts
// already established for Weekly Challenges, at a daily cadence instead:
// every real UTC calendar day (00:00 UTC, the same boundary
// apps/web/src/lib/streak.ts and xp.ts already use) lazily gets its own
// 3 Challenge rows (type: "DAILY") the first time anything touches that
// day, and every quest is recomputed from real TrainingSession/Trial/
// XpEntry rows on every sync call — never a hand-incremented counter.
//
// Deliberately smaller and lower-effort than the 5 Weekly Challenges
// (3 quests, all completable from a single session) — project_prompt.txt's
// "avoid challenges encouraging excessive usage" warning applies even
// more directly to a challenge set that resets every 24h than to one
// that resets weekly, so this stays a small, fixed, non-escalating set
// rather than growing over time.

export const DAILY_SESSION_COUNT_TARGET = 1;
export const DAILY_XP_TARGET = 20; // well under xp.ts's own DAILY_XP_CAP (150) — reachable from one normal session, not a grind target
export const DAILY_ACCURACY_FLOOR = 0.85;

export type DailyQuestCriteria =
  | { kind: "complete_sessions"; count: number }
  | { kind: "earn_xp"; amount: number }
  | { kind: "session_accuracy_floor"; floor: number };

interface DailyQuestTemplate {
  slug: string;
  title: string;
  description: string;
  criteria: DailyQuestCriteria;
}

const DAILY_QUEST_TEMPLATES: DailyQuestTemplate[] = [
  {
    slug: "daily-complete-session",
    title: "Complete a session",
    description: "Finish 1 training session today.",
    criteria: { kind: "complete_sessions", count: DAILY_SESSION_COUNT_TARGET },
  },
  {
    slug: "daily-earn-xp",
    title: `Earn ${DAILY_XP_TARGET} XP`,
    description: `Earn ${DAILY_XP_TARGET} XP today.`,
    criteria: { kind: "earn_xp", amount: DAILY_XP_TARGET },
  },
  {
    slug: "daily-accuracy",
    title: "Score strong accuracy",
    description: `Complete a session at or above ${Math.round(DAILY_ACCURACY_FLOOR * 100)}% accuracy.`,
    criteria: { kind: "session_accuracy_floor", floor: DAILY_ACCURACY_FLOOR },
  },
];

function targetFor(criteria: DailyQuestCriteria): number {
  if (criteria.kind === "complete_sessions") return criteria.count;
  if (criteria.kind === "earn_xp") return criteria.amount;
  return 1;
}

/** Ensures the current real UTC day has all 3 daily Challenge rows, creating any missing ones. Safe to call repeatedly and concurrently. */
export async function getOrCreateTodaysQuests(now: Date = new Date()) {
  const startsAt = startOfUtcDay(now);
  const endsAt = new Date(startsAt.getTime() + MS_PER_DAY);

  const existing = await prisma.challenge.findMany({ where: { type: "DAILY", startsAt } });
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const missing = DAILY_QUEST_TEMPLATES.filter((t) => !existingSlugs.has(t.slug));

  if (missing.length > 0) {
    await prisma.challenge.createMany({
      data: missing.map((t) => ({
        slug: t.slug,
        title: t.title,
        description: t.description,
        type: "DAILY" as const,
        criteria: t.criteria as unknown as Prisma.InputJsonValue,
        startsAt,
        endsAt,
      })),
      skipDuplicates: true, // guards a race between two concurrent requests in the same newly-rolled-over day
    });
    return prisma.challenge.findMany({ where: { type: "DAILY", startsAt } });
  }

  return existing;
}

async function upsertProgress(challengeId: string, userId: string, progressValue: number, target: number, now: Date) {
  const existing = await prisma.challengeProgress.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  const nowComplete = progressValue >= target;
  await prisma.challengeProgress.upsert({
    where: { challengeId_userId: { challengeId, userId } },
    create: { challengeId, userId, progressValue, completedAt: nowComplete ? now : null },
    // Once completed, stays completed for the day — matches
    // weekly-challenges.ts's own "monotonic" rule.
    update: { progressValue, completedAt: existing?.completedAt ?? (nowComplete ? now : null) },
  });
}

/**
 * Recomputes this user's progress on every one of today's quests from
 * real data and writes the result. Call this from every real trigger
 * point Weekly Challenges already syncs from — a training session's
 * completion, an exercise's completion, an assessment completion, and
 * onboarding completion — so daily quests advance from the same real
 * events, no new instrumentation.
 */
export async function syncDailyQuestProgress(userId: string, now: Date = new Date()): Promise<void> {
  const quests = await getOrCreateTodaysQuests(now);
  const startsAt = startOfUtcDay(now);
  const endsAt = new Date(startsAt.getTime() + MS_PER_DAY);

  const sessionsToday = await prisma.trainingSession.findMany({
    where: { userId, status: "COMPLETED", completedAt: { gte: startsAt, lt: endsAt } },
    select: { id: true },
  });
  const sessionIds = sessionsToday.map((s) => s.id);

  const trialsToday = sessionIds.length
    ? await prisma.trial.findMany({
        where: { trainingSessionId: { in: sessionIds } },
        select: { trainingSessionId: true, correct: true },
      })
    : [];

  const accuracyBySession = new Map<string, { correct: number; total: number }>();
  for (const t of trialsToday) {
    const entry = accuracyBySession.get(t.trainingSessionId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (t.correct) entry.correct += 1;
    accuracyBySession.set(t.trainingSessionId, entry);
  }
  const metAccuracyFloor = [...accuracyBySession.values()].some(
    (a) => a.total > 0 && a.correct / a.total >= DAILY_ACCURACY_FLOOR
  );

  const xpToday = await prisma.xpEntry.aggregate({
    where: { userId, createdAt: { gte: startsAt, lt: endsAt } },
    _sum: { amount: true },
  });
  const xpEarnedToday = xpToday._sum.amount ?? 0;

  for (const quest of quests) {
    const criteria = quest.criteria as unknown as DailyQuestCriteria;
    const target = targetFor(criteria);
    switch (criteria.kind) {
      case "complete_sessions":
        await upsertProgress(quest.id, userId, sessionIds.length, target, now);
        break;
      case "earn_xp":
        await upsertProgress(quest.id, userId, xpEarnedToday, target, now);
        break;
      case "session_accuracy_floor":
        await upsertProgress(quest.id, userId, metAccuracyFloor ? 1 : 0, target, now);
        break;
    }
  }
}

export interface DailyQuestStatus {
  slug: string;
  /** English copy as stored on the Challenge row — the fallback if the slug has no translation. */
  title: string;
  description: string;
  /** Values the translated title/description interpolate (messages challenges.items.<slug>). */
  messageParams: Record<string, number>;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  completedAt: string | null;
  endsAt: string;
}

/** Read side for /challenges — today's 3 quests plus this user's real progress on each (0/unearned if they have no ChallengeProgress row yet). */
export async function getDailyQuestsStatus(userId: string, now: Date = new Date()): Promise<DailyQuestStatus[]> {
  const quests = await getOrCreateTodaysQuests(now);
  const progressRows = await prisma.challengeProgress.findMany({
    where: { userId, challengeId: { in: quests.map((c) => c.id) } },
  });
  const progressByChallengeId = new Map(progressRows.map((p) => [p.challengeId, p]));

  return quests
    .map((quest) => {
      const criteria = quest.criteria as unknown as DailyQuestCriteria;
      const target = targetFor(criteria);
      const progress = progressByChallengeId.get(quest.id);
      return {
        slug: quest.slug,
        title: quest.title,
        description: quest.description,
        messageParams: { count: target, amount: target, pct: Math.round(DAILY_ACCURACY_FLOOR * 100) },
        progressCurrent: Math.min(progress?.progressValue ?? 0, target),
        progressTarget: target,
        completed: progress?.completedAt != null,
        completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
        endsAt: quest.endsAt.toISOString(),
      };
    })
    .sort((a, b) => DAILY_QUEST_TEMPLATES.findIndex((t) => t.slug === a.slug) - DAILY_QUEST_TEMPLATES.findIndex((t) => t.slug === b.slug));
}

import { prisma, Prisma } from "@lean-academy/db";
import { COMPREHENSION_FLOOR } from "@lean-academy/reading-engine";
import { startOfUtcWeek, MS_PER_DAY } from "@/lib/date-utils";

// Weekly challenges — Phase 5's last card (see docs/kanban.md). Real
// rotation/generation, not a static list: every real UTC week (Monday
// 00:00 UTC, same boundary apps/web/src/lib/streak.ts and
// achievements.ts already use) gets its own 5 Challenge rows, lazily
// created the first time anything touches the current week (a
// training-session completion, an exercise completion, an assessment,
// or just visiting /challenges) rather than needing a cron job this
// project has no infrastructure for yet.
//
// The 5 challenges are project_prompt.txt's own WEEKLY CHALLENGES
// examples verbatim, not invented ones — "Complete 4 sessions," "Train 3
// different cognitive domains," "Complete a reading session with a
// target comprehension," "Beat one personal training record," "Complete
// one assessment." Every week gets the same 5 (no randomized subset) —
// project_prompt.txt's own explicit warning ("avoid challenges
// encouraging excessive usage") argues against inventing a bigger or
// escalating set on top of the given examples, and a fixed, predictable
// set is easier to keep non-manipulative than a shifting one.
//
// A Challenge row is global per week (shared by every user, like a
// template); ChallengeProgress is the real per-user progress against it
// — see schema.prisma's own comment on why that join table exists.
// slug + @@unique([slug, startsAt]) gives each week's copy of a
// template a stable, idempotent identity so concurrent requests in a
// freshly-rolled-over week can't create duplicate rows (skipDuplicates
// below), without needing to parse the opaque `criteria` JSON to tell
// "this week's train-3-domains challenge" apart from another week's.
//
// Every challenge here is recomputed from real TrainingSession/Trial/
// AssessmentResult data each time it's synced — the same "aggregate
// over real rows, never a hand-incremented counter that can drift"
// pattern apps/web/src/lib/xp.ts's getTotalXp and
// apps/web/src/lib/personal-bests.ts already use — with one deliberate
// exception: "beat a personal record" is recorded as a real event at
// the moment apps/web/src/lib/achievements.ts's checkExerciseAchievements
// already determines it (its own newPersonalBest return value), rather
// than re-deriving "was any Trial this week a new all-time best"
// historically, which would mean re-running that same historical
// max-vs-this-session comparison for every trial in the week instead of
// once, at the moment it actually happens.

const READING_METHOD = "reading-paced-adaptive-v0"; // matches personal-bests.ts's own constant

// project_prompt.txt's own example: "Complete 4 sessions." Also reused
// by apps/web/src/lib/achievements.ts's "weekly-sessions-complete"
// milestone (previously a separately-hardcoded 5) so the two features
// share one real number instead of two independently-guessed ones.
export const WEEKLY_SESSION_COUNT_TARGET = 4;
export const WEEKLY_DOMAIN_COUNT_TARGET = 3;

export type WeeklyChallengeCriteria =
  | { kind: "complete_sessions"; count: number }
  | { kind: "train_domains"; count: number }
  | { kind: "reading_comprehension_floor" }
  | { kind: "beat_personal_record" }
  | { kind: "complete_assessment" };

interface WeeklyChallengeTemplate {
  slug: string;
  title: string;
  description: string;
  criteria: WeeklyChallengeCriteria;
}

const WEEKLY_CHALLENGE_TEMPLATES: WeeklyChallengeTemplate[] = [
  {
    slug: "complete-sessions",
    title: `Complete ${WEEKLY_SESSION_COUNT_TARGET} sessions`,
    description: `Finish ${WEEKLY_SESSION_COUNT_TARGET} training sessions this week.`,
    criteria: { kind: "complete_sessions", count: WEEKLY_SESSION_COUNT_TARGET },
  },
  {
    slug: "train-domains",
    title: `Train ${WEEKLY_DOMAIN_COUNT_TARGET} different domains`,
    description: `Complete a session in ${WEEKLY_DOMAIN_COUNT_TARGET} different cognitive domains this week.`,
    criteria: { kind: "train_domains", count: WEEKLY_DOMAIN_COUNT_TARGET },
  },
  {
    slug: "reading-comprehension",
    title: "Read with strong comprehension",
    description: `Complete a reading session at or above ${Math.round(COMPREHENSION_FLOOR * 100)}% comprehension.`,
    criteria: { kind: "reading_comprehension_floor" },
  },
  {
    slug: "beat-personal-record",
    title: "Beat a personal record",
    description: "Beat one of your own personal training records.",
    criteria: { kind: "beat_personal_record" },
  },
  {
    slug: "complete-assessment",
    title: "Complete an assessment",
    description: "Complete one training assessment.",
    criteria: { kind: "complete_assessment" },
  },
];

function targetFor(criteria: WeeklyChallengeCriteria): number {
  return criteria.kind === "complete_sessions" || criteria.kind === "train_domains" ? criteria.count : 1;
}

/** Ensures the current real UTC week has all 5 Challenge rows, creating any missing ones. Safe to call repeatedly and concurrently. */
export async function getOrCreateCurrentWeekChallenges(now: Date = new Date()) {
  const startsAt = startOfUtcWeek(now);
  const endsAt = new Date(startsAt.getTime() + 7 * MS_PER_DAY);

  const existing = await prisma.challenge.findMany({ where: { type: "WEEKLY", startsAt } });
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const missing = WEEKLY_CHALLENGE_TEMPLATES.filter((t) => !existingSlugs.has(t.slug));

  if (missing.length > 0) {
    await prisma.challenge.createMany({
      data: missing.map((t) => ({
        slug: t.slug,
        title: t.title,
        description: t.description,
        type: "WEEKLY" as const,
        criteria: t.criteria as unknown as Prisma.InputJsonValue,
        startsAt,
        endsAt,
      })),
      skipDuplicates: true, // guards a race between two concurrent requests in the same newly-rolled-over week
    });
    return prisma.challenge.findMany({ where: { type: "WEEKLY", startsAt } });
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
    // Once completed, stays completed for the week — a later call can't
    // un-complete it even if progressValue is recomputed differently.
    update: { progressValue, completedAt: existing?.completedAt ?? (nowComplete ? now : null) },
  });
}

/**
 * Recomputes this user's progress on every one of the current week's
 * challenges from real data and writes the result. Call this from every
 * real trigger point: a training session's completion, an exercise's
 * completion (passing whether *that* completion just set a genuine new
 * personal best, per achievements.ts's checkExerciseAchievements), and
 * a new AssessmentResult being created.
 */
export async function syncWeeklyChallengeProgress(
  userId: string,
  now: Date = new Date(),
  opts: { newPersonalBestThisCall?: boolean } = {}
): Promise<void> {
  const challenges = await getOrCreateCurrentWeekChallenges(now);
  const startsAt = startOfUtcWeek(now);
  const endsAt = new Date(startsAt.getTime() + 7 * MS_PER_DAY);

  const sessionsThisWeek = await prisma.trainingSession.findMany({
    where: { userId, status: "COMPLETED", completedAt: { gte: startsAt, lt: endsAt } },
    select: { id: true },
  });
  const sessionIds = sessionsThisWeek.map((s) => s.id);
  const sessionCount = sessionIds.length;

  const trialsThisWeek = sessionIds.length
    ? await prisma.trial.findMany({
        where: { trainingSessionId: { in: sessionIds } },
        select: {
          trainingSessionId: true,
          correct: true,
          taskVersion: { select: { taskDefinition: { select: { domain: true, method: true } } } },
        },
      })
    : [];

  const distinctDomains = new Set(trialsThisWeek.map((t) => t.taskVersion.taskDefinition.domain)).size;

  const readingAccuracyBySession = new Map<string, { correct: number; total: number }>();
  for (const t of trialsThisWeek) {
    if (t.taskVersion.taskDefinition.method !== READING_METHOD) continue;
    const entry = readingAccuracyBySession.get(t.trainingSessionId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (t.correct) entry.correct += 1;
    readingAccuracyBySession.set(t.trainingSessionId, entry);
  }
  const readingFloorMetThisWeek = [...readingAccuracyBySession.values()].some(
    (a) => a.total > 0 && a.correct / a.total >= COMPREHENSION_FLOOR
  );

  const assessmentCountThisWeek = await prisma.assessmentResult.count({
    where: { userId, takenAt: { gte: startsAt, lt: endsAt } },
  });

  for (const challenge of challenges) {
    const criteria = challenge.criteria as unknown as WeeklyChallengeCriteria;
    const target = targetFor(criteria);
    switch (criteria.kind) {
      case "complete_sessions":
        await upsertProgress(challenge.id, userId, sessionCount, target, now);
        break;
      case "train_domains":
        await upsertProgress(challenge.id, userId, distinctDomains, target, now);
        break;
      case "reading_comprehension_floor":
        await upsertProgress(challenge.id, userId, readingFloorMetThisWeek ? 1 : 0, target, now);
        break;
      case "complete_assessment":
        await upsertProgress(challenge.id, userId, assessmentCountThisWeek > 0 ? 1 : 0, target, now);
        break;
      case "beat_personal_record":
        if (opts.newPersonalBestThisCall) {
          await upsertProgress(challenge.id, userId, 1, target, now);
        }
        break;
    }
  }
}

export interface WeeklyChallengeStatus {
  slug: string;
  title: string;
  description: string;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  completedAt: string | null;
  endsAt: string;
}

/** Read side for the /challenges page — the current week's 5 challenges plus this user's real progress on each (0/unearned if they have no ChallengeProgress row yet). */
export async function getWeeklyChallengesStatus(userId: string, now: Date = new Date()): Promise<WeeklyChallengeStatus[]> {
  const challenges = await getOrCreateCurrentWeekChallenges(now);
  const progressRows = await prisma.challengeProgress.findMany({
    where: { userId, challengeId: { in: challenges.map((c) => c.id) } },
  });
  const progressByChallengeId = new Map(progressRows.map((p) => [p.challengeId, p]));

  return challenges
    .map((challenge) => {
      const criteria = challenge.criteria as unknown as WeeklyChallengeCriteria;
      const target = targetFor(criteria);
      const progress = progressByChallengeId.get(challenge.id);
      return {
        slug: challenge.slug,
        title: challenge.title,
        description: challenge.description,
        progressCurrent: Math.min(progress?.progressValue ?? 0, target),
        progressTarget: target,
        completed: progress?.completedAt != null,
        completedAt: progress?.completedAt ? progress.completedAt.toISOString() : null,
        endsAt: challenge.endsAt.toISOString(),
      };
    })
    .sort((a, b) => WEEKLY_CHALLENGE_TEMPLATES.findIndex((t) => t.slug === a.slug) - WEEKLY_CHALLENGE_TEMPLATES.findIndex((t) => t.slug === b.slug));
}

import { prisma, Prisma } from "@lean-academy/db";
import { READING_DEFAULT_INITIAL_DIFFICULTY } from "@lean-academy/reading-engine";

// Achievements epic (Phase 5 — see docs/kanban.md). The catalog itself
// (11 real, checkable milestones) lives in
// packages/db/src/achievement-catalog.ts and is seeded by
// prisma/seed.ts; this file only decides *when* each one is earned,
// called from the real completion points that already exist:
// POST /api/training-sessions/:id/complete (session-count and streak
// milestones), POST /api/training-sessions/:id/exercises (per-task
// difficulty/comprehension milestones), and the onboarding completion
// route (the first-assessment milestone).
//
// awardAchievementOnce is a Prisma upsert against
// UserAchievement's @@unique([userId, achievementId]) constraint, so
// calling it for an already-earned achievement is a safe no-op rather
// than something callers need to guard against themselves.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function awardAchievementOnce(userId: string, key: string, metadata?: Prisma.InputJsonValue) {
  const achievement = await prisma.achievement.findUnique({ where: { key } });
  if (!achievement) return; // seed hasn't run for this key — don't fail the caller's real work over it

  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
    create: { userId, achievementId: achievement.id, metadata },
    update: {},
  });
}

export function startOfUtcWeek(now: Date): Date {
  // Monday 00:00 UTC of the week containing `now` — the same kind of
  // UTC-calendar simplification apps/web/src/lib/streak.ts documents
  // (no per-user timezone yet). getUTCDay(): 0=Sun..6=Sat.
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const utcMidnightToday = Math.floor(now.getTime() / MS_PER_DAY) * MS_PER_DAY;
  return new Date(utcMidnightToday - daysSinceMonday * MS_PER_DAY);
}

// Fixed v0 default until Weekly Challenges (docs/kanban.md's Phase 5
// backlog) exists and can carry a real per-user weekly target instead.
export const WEEKLY_SESSION_TARGET = 5;

export const SESSION_COUNT_MILESTONES: { count: number; key: string }[] = [
  { count: 1, key: "first-session" },
  { count: 10, key: "sessions-10" },
  { count: 30, key: "sessions-30" },
  { count: 100, key: "sessions-100" },
];

/**
 * Called after a TrainingSession is marked COMPLETED and its streak is
 * updated. Checks every session-count milestone, "First Week" (the
 * user's streak reaching 7 for the first time — reuses the real Streak
 * update from the same request rather than re-deriving it), and the
 * fixed weekly-session-count milestone.
 */
export async function checkSessionCompletionAchievements(userId: string, currentStreakDays: number, now: Date = new Date()) {
  const completedCount = await prisma.trainingSession.count({ where: { userId, status: "COMPLETED" } });
  for (const milestone of SESSION_COUNT_MILESTONES) {
    if (completedCount === milestone.count) await awardAchievementOnce(userId, milestone.key);
  }

  if (currentStreakDays === 7) {
    await awardAchievementOnce(userId, "first-week");
  }

  const weekCount = await prisma.trainingSession.count({
    where: { userId, status: "COMPLETED", completedAt: { gte: startOfUtcWeek(now) } },
  });
  if (weekCount >= WEEKLY_SESSION_TARGET) {
    await awardAchievementOnce(userId, "weekly-sessions-complete");
  }
}

export interface ExerciseAchievementInput {
  userId: string;
  method: string;
  domain: string;
  taskVersionId: string;
  trainingSessionId: string;
  startDifficulty: number;
  endDifficulty: number;
  sessionCorrect: number;
  sessionTotal: number;
}

/**
 * Called after an exercise's Trial rows are persisted and its
 * DifficultyState is updated. Checks: Working Memory Level 5 (either
 * WORKING_MEMORY task reaching the same numeric threshold — an explicit
 * design decision, since N-Back's 1-9 range and Complex Span's 3-9
 * range aren't otherwise comparable, see docs/kanban.md's Achievements
 * card), Personal Best (this task's difficulty exceeding the highest
 * it had ever reached before this session, across any task), the
 * Reading Efficiency Milestone (pace increased beyond the starting
 * default), and "maintained 90% comprehension at a new pace" (pace
 * increased *this session* while this session's own comprehension
 * stayed at or above 90%).
 */
export async function checkExerciseAchievements(input: ExerciseAchievementInput) {
  const { userId, method, domain, taskVersionId, trainingSessionId, startDifficulty, endDifficulty, sessionCorrect, sessionTotal } = input;

  if (domain === "WORKING_MEMORY" && endDifficulty >= 5) {
    await awardAchievementOnce(userId, "working-memory-level-5", { method });
  }

  const priorBest = await prisma.trial.aggregate({
    where: { taskVersionId, trainingSession: { userId }, trainingSessionId: { not: trainingSessionId } },
    _max: { difficultyAtTrial: true },
  });
  const priorMax = priorBest._max.difficultyAtTrial;
  if (priorMax !== null && endDifficulty > priorMax) {
    await awardAchievementOnce(userId, "personal-best", { method });
  }

  if (method === "reading-paced-adaptive-v0") {
    if (endDifficulty > READING_DEFAULT_INITIAL_DIFFICULTY) {
      await awardAchievementOnce(userId, "reading-efficiency-milestone");
    }
    if (endDifficulty > startDifficulty && sessionTotal > 0 && sessionCorrect / sessionTotal >= 0.9) {
      await awardAchievementOnce(userId, "reading-comprehension-at-new-pace");
    }
  }
}

/** Called after a user's first-ever AssessmentResult is created. */
export async function checkFirstAssessmentAchievement(userId: string) {
  const count = await prisma.assessmentResult.count({ where: { userId } });
  if (count === 1) {
    await awardAchievementOnce(userId, "first-assessment");
  }
}

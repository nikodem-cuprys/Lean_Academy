import { prisma, type XpReason } from "@lean-academy/db";

// XP + Training Level (Phase 5 — see docs/kanban.md). project_prompt.txt's
// XP AND LEVELS section names four real sources — completing recommended
// training, consistency, trying new domains, genuine task milestones —
// and explicitly requires an anti-grind cap ("cap or reduce XP from
// excessive training"). USER LEVEL requires a separate "Training Level"
// derived from XP via a documented formula, never presented as
// cognitive ability.
//
// Every award is a real XpEntry row (see schema.prisma), not a mutable
// running total, so the daily cap can be computed honestly from real
// history and there's a real audit trail for Training Level.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Fixed award amounts per source, each tied to a real, checkable event.
export const XP_AMOUNTS = {
  SESSION_COMPLETION: 20,
  NEW_DOMAIN_BONUS: 15,
  ACHIEVEMENT_BONUS: 25,
} as const;

// Consistency bonus scales with the real Streak length (see
// apps/web/src/lib/streak.ts), capped so a long-running streak doesn't
// pay out an ever-growing per-session amount — 2 XP/day up to a 10-day
// streak, i.e. a ceiling of 20 XP.
const CONSISTENCY_BONUS_PER_STREAK_DAY = 2;
const CONSISTENCY_BONUS_STREAK_DAY_CAP = 10;

export function consistencyBonusFor(currentStreakDays: number): number {
  return Math.min(currentStreakDays, CONSISTENCY_BONUS_STREAK_DAY_CAP) * CONSISTENCY_BONUS_PER_STREAK_DAY;
}

// Anti-grind cap: project_prompt.txt's own instruction ("avoid rewarding
// endless repetitive grinding... the goal is healthy consistency, not
// maximizing screen time") — a real ceiling on total XP earned per real
// UTC calendar day, not an implicit/soft limit. Same UTC-day
// simplification streak.ts already documents (no per-user timezone yet).
export const DAILY_XP_CAP = 150;

function startOfUtcDay(now: Date): Date {
  return new Date(Math.floor(now.getTime() / MS_PER_DAY) * MS_PER_DAY);
}

// Training Level formula: cumulative XP needed to reach level L (from
// level 1, 0 XP) is a triangular curve, 100 * (L-1) * L / 2 — level 2 at
// 100 XP, level 3 at 300, level 4 at 600, level 5 at 1000, etc. Each
// level costs 100 XP more than the last. Documented here as the one
// place this formula is allowed to live; never reimplement it inline.
export function xpThresholdForLevel(level: number): number {
  return (100 * (level - 1) * level) / 2;
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpThresholdForLevel(level + 1) <= totalXp) level++;
  return level;
}

export interface XpAwardResult {
  awarded: number;
  totalXpBefore: number;
  totalXpAfter: number;
  levelBefore: number;
  levelAfter: number;
}

async function getTotalXp(userId: string): Promise<number> {
  const result = await prisma.xpEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

/**
 * Awards XP for one real event, clamped by the real daily cap computed
 * from today's actual XpEntry rows. Returns 0 awarded (no row written)
 * if the cap is already reached — never a negative award.
 */
export async function awardXp(
  userId: string,
  amount: number,
  reason: XpReason,
  trainingSessionId?: string,
  now: Date = new Date()
): Promise<XpAwardResult> {
  const totalXpBefore = await getTotalXp(userId);
  const levelBefore = levelForXp(totalXpBefore);

  const todayResult = await prisma.xpEntry.aggregate({
    where: { userId, createdAt: { gte: startOfUtcDay(now) } },
    _sum: { amount: true },
  });
  const awardedToday = todayResult._sum.amount ?? 0;
  const awarded = Math.max(0, Math.min(amount, DAILY_XP_CAP - awardedToday));

  if (awarded > 0) {
    await prisma.xpEntry.create({
      data: { userId, amount: awarded, reason, trainingSessionId, createdAt: now },
    });
  }

  const totalXpAfter = totalXpBefore + awarded;
  return {
    awarded,
    totalXpBefore,
    totalXpAfter,
    levelBefore,
    levelAfter: levelForXp(totalXpAfter),
  };
}

export interface SessionCompletionXpResult extends XpAwardResult {
  leveledUp: boolean;
}

/** Called after a TrainingSession completes — awards base completion XP plus a real consistency bonus from the streak this same completion just produced. */
export async function recordSessionCompletionXp(
  userId: string,
  trainingSessionId: string,
  currentStreakDays: number,
  now: Date = new Date()
): Promise<SessionCompletionXpResult> {
  const totalXpBefore = await getTotalXp(userId);
  const levelBefore = levelForXp(totalXpBefore);

  const completion = await awardXp(userId, XP_AMOUNTS.SESSION_COMPLETION, "SESSION_COMPLETION", trainingSessionId, now);
  const consistencyAmount = consistencyBonusFor(currentStreakDays);
  const consistency =
    consistencyAmount > 0
      ? await awardXp(userId, consistencyAmount, "CONSISTENCY_BONUS", trainingSessionId, now)
      : { awarded: 0, totalXpAfter: completion.totalXpAfter, levelAfter: completion.levelAfter };

  const totalXpAfter = consistency.totalXpAfter;
  const levelAfter = consistency.levelAfter;
  return {
    awarded: completion.awarded + consistency.awarded,
    totalXpBefore,
    totalXpAfter,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
  };
}

/**
 * Called after an exercise's Trial rows are persisted — awards a
 * one-time bonus the first time this user has ever completed this
 * specific method, a real "trying a new training domain" event.
 */
export async function recordNewDomainXpIfFirstTime(
  userId: string,
  taskVersionId: string,
  trainingSessionId: string
): Promise<XpAwardResult | null> {
  const priorTrial = await prisma.trial.findFirst({
    where: { taskVersionId, trainingSession: { userId }, trainingSessionId: { not: trainingSessionId } },
  });
  if (priorTrial) return null;
  return awardXp(userId, XP_AMOUNTS.NEW_DOMAIN_BONUS, "NEW_DOMAIN_BONUS", trainingSessionId);
}

export interface TrainingLevelStatus {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export async function getTrainingLevelStatus(userId: string): Promise<TrainingLevelStatus> {
  const totalXp = await getTotalXp(userId);
  const level = levelForXp(totalXp);
  return {
    totalXp,
    level,
    xpIntoLevel: totalXp - xpThresholdForLevel(level),
    xpForNextLevel: xpThresholdForLevel(level + 1) - xpThresholdForLevel(level),
  };
}

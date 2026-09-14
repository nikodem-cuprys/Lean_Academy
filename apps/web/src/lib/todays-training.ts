import { prisma } from "@lean-academy/db";

/**
 * Picks one exercise per domain the user has a DifficultyState for
 * (from onboarding calibration or a prior session), in a fixed
 * WORKING_MEMORY -> READING -> SPATIAL order matching
 * prototype/Home.dc.html's "Today's Training" card. When a domain has
 * more than one implemented exercise (currently only WORKING_MEMORY:
 * adaptive-nback-v0 and complex-span-v0), alternates across them by the
 * user's completed session count, so the same one isn't picked every
 * day. Returns null if the user has no DifficultyState rows at all
 * (hasn't completed onboarding/calibration yet) — the Home page uses
 * that to show an onboarding prompt instead of a training card.
 */

export interface TodaysExercise {
  method: string;
  displayName: string;
  domain: string;
  initialDifficulty: number;
}

const DOMAIN_ORDER = ["WORKING_MEMORY", "READING", "SPATIAL"] as const;

export async function getTodaysTraining(userId: string): Promise<TodaysExercise[] | null> {
  const difficultyStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });
  if (difficultyStates.length === 0) return null;

  const byDomain = new Map<string, typeof difficultyStates>();
  for (const ds of difficultyStates) {
    const domain = ds.taskVersion.taskDefinition.domain;
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(ds);
  }

  const completedSessionCount = await prisma.trainingSession.count({
    where: { userId, status: "COMPLETED" },
  });

  const picked: TodaysExercise[] = [];
  for (const domain of DOMAIN_ORDER) {
    const candidates = byDomain.get(domain);
    if (!candidates || candidates.length === 0) continue;
    const chosen = candidates[completedSessionCount % candidates.length];
    picked.push({
      method: chosen.taskVersion.taskDefinition.method,
      displayName: chosen.taskVersion.taskDefinition.displayName,
      domain,
      initialDifficulty: chosen.currentDifficulty,
    });
  }
  return picked;
}

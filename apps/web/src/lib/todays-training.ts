import { prisma } from "@lean-academy/db";
import { TASK_BOUNDS } from "@/lib/task-bounds";

/**
 * Picks one exercise per domain the user has a DifficultyState for
 * (from onboarding calibration or a prior session), in a fixed
 * WORKING_MEMORY -> READING -> SPATIAL order matching
 * prototype/Home.dc.html's "Today's Training" card. When a domain has
 * more than one implemented exercise (WORKING_MEMORY: adaptive-nback-v0,
 * complex-span-v0, and dice-sum-v0), alternates across them by the
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

// Dice Sum joins the daily WORKING_MEMORY rotation alongside N-Back and
// Complex Span (see docs/kanban.md) — but onboarding's calibration
// battery only ever covers the 4 exercises it was originally built for
// (OnboardingFlow.tsx), and adding Dice Sum as a real 5th calibration
// mini-step is a separate, larger UI build than "add it to daily
// training" asked for. Instead, any already-onboarded user (someone
// with at least one real DifficultyState already, i.e. has genuinely
// completed onboarding) lazily gets a real DifficultyState for Dice Sum
// the first time it's needed, seeded at the exact same
// DICE_SUM_DEFAULT_INITIAL_COUNT every fresh DiceSumTask() already uses
// as its own starting point when nothing overrides it — not an
// invented number, the task's own real default — and the adaptive
// engine takes over from there based on genuine performance, same as
// every other exercise.
async function ensureDiceSumDifficultyState(userId: string, hasAnyDifficultyState: boolean): Promise<void> {
  if (!hasAnyDifficultyState) return; // don't bootstrap for someone who hasn't onboarded at all yet

  const existing = await prisma.difficultyState.findFirst({
    where: { userId, taskVersion: { taskDefinition: { method: "dice-sum-v0" } } },
  });
  if (existing) return;

  const definition = await prisma.taskDefinition.findUnique({
    where: { method: "dice-sum-v0" },
    include: { versions: { orderBy: { releasedAt: "desc" }, take: 1 } },
  });
  const taskVersion = definition?.versions[0];
  if (!taskVersion) return; // seed hasn't run for this task yet

  await prisma.difficultyState.upsert({
    where: { userId_taskVersionId: { userId, taskVersionId: taskVersion.id } },
    create: { userId, taskVersionId: taskVersion.id, currentDifficulty: TASK_BOUNDS["dice-sum-v0"].default },
    update: {},
  });
}

export async function getTodaysTraining(userId: string): Promise<TodaysExercise[] | null> {
  const initialStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });
  if (initialStates.length === 0) return null;

  await ensureDiceSumDifficultyState(userId, initialStates.length > 0);

  const difficultyStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });

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

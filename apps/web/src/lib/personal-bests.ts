import { prisma } from "@lean-academy/db";
import { calculateReadingEfficiencyScore } from "@lean-academy/reading-engine";
import { actualWpmFromMetadata } from "@/lib/progress-data";

// Personal Bests (Phase 5 — see docs/kanban.md). Computed at query time
// from real Trial/DifficultyState data, the same way apps/web/src/lib/
// progress-data.ts derives everything else — no new table, so there's
// no second, separately-maintained source of truth to drift out of
// sync with the real training history.
//
// This supersedes the Achievements card's own lightweight personal-best
// check (apps/web/src/lib/achievements.ts) with a real per-task view
// rather than a single one-time badge: that badge only ever fires once,
// ever, across every task a user trains — this module answers "what's
// my current best on *this* task," reusable and correct at any time.
// checkNewPersonalBest below is now the one shared implementation both
// the Achievements "Personal Best" check and the real-time Session
// Complete surfacing call — including a real fix for reading, whose
// "personal best" previously (in achievements.ts) compared raw target-
// WPM ladder index, the same metric used for every other task; reading
// gets its own metric here, the real Reading Efficiency Score (WPM
// combined with comprehension, per project_prompt.txt's "best reading
// efficiency" phrasing), since a faster pace with worse comprehension
// isn't a genuine improvement.

const READING_METHOD = "reading-paced-adaptive-v0";

export function formatPersonalBestLabel(method: string, difficulty: number): string {
  // Matches progress-data.ts's formatProgressLabel per-method phrasing.
  if (method === "complex-span-v0") return `${difficulty}-item span`;
  return `Level ${difficulty}`;
}

interface ReadingSessionScore {
  score: number;
  wpm: number;
  comprehensionPct: number;
  achievedAt: Date;
}

function scoreReadingTrials(trials: { correct: boolean; metadata: unknown; stimulusStartedAt: Date }[]): ReadingSessionScore | null {
  const wpmValues = trials.map((t) => actualWpmFromMetadata(t.metadata)).filter((v): v is number => v !== null);
  if (wpmValues.length === 0) return null;
  const averageWpm = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
  const comprehensionAccuracy = trials.filter((t) => t.correct).length / trials.length;
  const score = calculateReadingEfficiencyScore({ averageWpm, comprehensionAccuracy });
  const achievedAt = trials.reduce((min, t) => (t.stimulusStartedAt < min ? t.stimulusStartedAt : min), trials[0].stimulusStartedAt);
  return { score, wpm: Math.round(averageWpm), comprehensionPct: Math.round(comprehensionAccuracy * 100), achievedAt };
}

async function scoreOneReadingSession(taskVersionId: string, trainingSessionId: string): Promise<ReadingSessionScore | null> {
  const trials = await prisma.trial.findMany({
    where: { taskVersionId, trainingSessionId },
    select: { correct: true, metadata: true, stimulusStartedAt: true },
  });
  return scoreReadingTrials(trials);
}

async function bestReadingSessionEver(
  userId: string,
  taskVersionId: string,
  excludeSessionId?: string
): Promise<ReadingSessionScore | null> {
  const trials = await prisma.trial.findMany({
    where: {
      taskVersionId,
      trainingSession: { userId },
      ...(excludeSessionId ? { trainingSessionId: { not: excludeSessionId } } : {}),
    },
    select: { trainingSessionId: true, correct: true, metadata: true, stimulusStartedAt: true },
  });

  const bySession = new Map<string, typeof trials>();
  for (const t of trials) {
    const list = bySession.get(t.trainingSessionId) ?? [];
    list.push(t);
    bySession.set(t.trainingSessionId, list);
  }

  let best: ReadingSessionScore | null = null;
  for (const sessionTrials of bySession.values()) {
    const scored = scoreReadingTrials(sessionTrials);
    if (scored && (!best || scored.score > best.score)) best = scored;
  }
  return best;
}

async function bestDifficultyEver(
  userId: string,
  taskVersionId: string,
  excludeSessionId?: string
): Promise<{ value: number; achievedAt: Date } | null> {
  const best = await prisma.trial.findFirst({
    where: {
      taskVersionId,
      trainingSession: { userId },
      ...(excludeSessionId ? { trainingSessionId: { not: excludeSessionId } } : {}),
    },
    orderBy: [{ difficultyAtTrial: "desc" }, { stimulusStartedAt: "asc" }],
    select: { difficultyAtTrial: true, stimulusStartedAt: true },
  });
  return best ? { value: best.difficultyAtTrial, achievedAt: best.stimulusStartedAt } : null;
}

/**
 * Did this specific exercise completion set a genuine new personal
 * best on this task — a real improvement over real prior history, not
 * a trivial "first attempt, nothing to beat yet" result. `endDifficulty`
 * is only used for non-reading tasks (reading uses the real Reading
 * Efficiency Score of this session's own trials instead).
 */
export async function checkNewPersonalBest(
  userId: string,
  method: string,
  taskVersionId: string,
  trainingSessionId: string,
  endDifficulty: number
): Promise<boolean> {
  if (method === READING_METHOD) {
    const thisSession = await scoreOneReadingSession(taskVersionId, trainingSessionId);
    if (!thisSession) return false;
    const priorBest = await bestReadingSessionEver(userId, taskVersionId, trainingSessionId);
    return priorBest !== null && thisSession.score > priorBest.score;
  }

  const priorBest = await bestDifficultyEver(userId, taskVersionId, trainingSessionId);
  return priorBest !== null && endDifficulty > priorBest.value;
}

export interface PersonalBestStatus {
  method: string;
  displayName: string;
  /** English label (formatPersonalBestLabel) — kept for callers/tests; the UI formats `value` in the viewer's language instead. */
  label: string | null;
  /** The raw best difficulty (level / span length) behind `label`. Null for reading, which uses wpm/comprehensionPct. */
  value: number | null;
  achievedAt: string | null;
  wpm?: number;
  comprehensionPct?: number;
}

/** The user's current real best on every task they've ever trained — for the Progress page. Reuses the exact same historical queries checkNewPersonalBest uses, just without excluding any session. */
export async function getPersonalBestsStatus(userId: string): Promise<PersonalBestStatus[]> {
  const difficultyStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });

  const results: PersonalBestStatus[] = [];
  for (const ds of difficultyStates) {
    const { method, displayName } = ds.taskVersion.taskDefinition;
    if (method === READING_METHOD) {
      const best = await bestReadingSessionEver(userId, ds.taskVersionId);
      results.push({
        method,
        displayName,
        label: null,
        value: null,
        achievedAt: best ? best.achievedAt.toISOString() : null,
        wpm: best?.wpm,
        comprehensionPct: best?.comprehensionPct,
      });
    } else {
      const best = await bestDifficultyEver(userId, ds.taskVersionId);
      results.push({
        method,
        displayName,
        label: best ? formatPersonalBestLabel(method, best.value) : null,
        value: best?.value ?? null,
        achievedAt: best ? best.achievedAt.toISOString() : null,
      });
    }
  }
  return results;
}

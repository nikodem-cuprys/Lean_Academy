import { prisma } from "@lean-academy/db";
import { parseEvidenceRegistry, findModule } from "@lean-academy/evidence";
import { TASK_BOUNDS } from "./task-bounds";
// Imported (not read via fs) — see the same comment on this import in
// apps/web/src/app/page.tsx.
import registryJson from "../../../../data/evidence-registry.json";

/**
 * Real data for the Progress page (prototype/Progress.dc.html), sourced
 * entirely from Trial/DifficultyState rows written by real training
 * sessions (see TrainingSessionRunner) — a user who has only tried
 * exercises via their standalone /train/<exercise> routes, never a real
 * session, has no Trial rows and shows up as "nothing trained yet."
 *
 * The "Trained" tab excludes reading — it gets its own dedicated card
 * (WPM + comprehension, a different shape of metric than the other
 * tasks' generic difficulty "level"), matching how the mockup itself
 * separates them.
 */

export interface TrainedTaskProgress {
  method: string;
  displayName: string;
  /** Title-cased evidenceLevel from data/evidence-registry.json, e.g. "Moderate". */
  evidenceBadge: string;
  progressLabel: string;
  /** 0-1, current difficulty's position on this task's own min-max range. */
  progressFraction: number;
}

export interface ReadingProgress {
  hasComparison: boolean;
  startWpm: number;
  endWpm: number;
  startComprehensionPct: number;
  endComprehensionPct: number;
}

export interface ProgressData {
  hasAnyData: boolean;
  trainedTasks: TrainedTaskProgress[];
  reading: ReadingProgress | null;
}

const READING_METHOD = "reading-paced-adaptive-v0";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatProgressLabel(method: string, startDifficulty: number, endDifficulty: number, sessionCount: number): string {
  if (method === "complex-span-v0") {
    return `${startDifficulty}-item → ${endDifficulty}-item best span`;
  }
  return `Level ${startDifficulty} → Level ${endDifficulty} over ${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
}

function actualWpmFromMetadata(metadata: unknown): number | null {
  if (metadata && typeof metadata === "object" && "actualWpm" in metadata) {
    const value = (metadata as { actualWpm?: unknown }).actualWpm;
    return typeof value === "number" ? value : null;
  }
  return null;
}

export async function getProgressData(userId: string): Promise<ProgressData> {
  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");

  const difficultyStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });

  const trainedTasks: TrainedTaskProgress[] = [];
  for (const ds of difficultyStates) {
    const { method, displayName } = ds.taskVersion.taskDefinition;
    if (method === READING_METHOD) continue;

    const trials = await prisma.trial.findMany({
      where: { taskVersionId: ds.taskVersionId, trainingSession: { userId } },
      orderBy: { stimulusStartedAt: "asc" },
      select: { difficultyAtTrial: true, trainingSessionId: true },
    });

    const bounds = TASK_BOUNDS[method];
    const currentDifficulty = ds.currentDifficulty;
    const progressFraction = bounds ? Math.max(0, Math.min(1, (currentDifficulty - bounds.min) / (bounds.max - bounds.min))) : 0;
    const evidenceModule = findModule(registry, method);
    const evidenceBadge = evidenceModule ? titleCase(evidenceModule.evidenceLevel) : "—";

    if (trials.length === 0) {
      trainedTasks.push({
        method,
        displayName,
        evidenceBadge,
        progressLabel: `Calibrated at Level ${currentDifficulty} — no training sessions yet`,
        progressFraction,
      });
      continue;
    }

    const startDifficulty = trials[0].difficultyAtTrial;
    const sessionCount = new Set(trials.map((t) => t.trainingSessionId)).size;
    trainedTasks.push({
      method,
      displayName,
      evidenceBadge,
      progressLabel: formatProgressLabel(method, startDifficulty, currentDifficulty, sessionCount),
      progressFraction,
    });
  }

  const readingDifficultyState = difficultyStates.find((ds) => ds.taskVersion.taskDefinition.method === READING_METHOD);
  let reading: ReadingProgress | null = null;
  if (readingDifficultyState) {
    const since = new Date(Date.now() - THIRTY_DAYS_MS);
    const readingTrials = await prisma.trial.findMany({
      where: {
        taskVersionId: readingDifficultyState.taskVersionId,
        trainingSession: { userId, startedAt: { gte: since } },
      },
      orderBy: { stimulusStartedAt: "asc" },
      select: { correct: true, metadata: true, trainingSessionId: true },
    });

    const sessionIds = Array.from(new Set(readingTrials.map((t) => t.trainingSessionId)));
    if (sessionIds.length >= 2) {
      const firstSessionId = sessionIds[0];
      const lastSessionId = sessionIds[sessionIds.length - 1];
      const firstTrials = readingTrials.filter((t) => t.trainingSessionId === firstSessionId);
      const lastTrials = readingTrials.filter((t) => t.trainingSessionId === lastSessionId);

      const avgWpm = (trials: typeof readingTrials) => {
        const values = trials.map((t) => actualWpmFromMetadata(t.metadata)).filter((v): v is number => v !== null);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      };
      const avgComprehension = (trials: typeof readingTrials) =>
        trials.length > 0 ? (trials.filter((t) => t.correct).length / trials.length) * 100 : 0;

      reading = {
        hasComparison: true,
        startWpm: Math.round(avgWpm(firstTrials)),
        endWpm: Math.round(avgWpm(lastTrials)),
        startComprehensionPct: Math.round(avgComprehension(firstTrials)),
        endComprehensionPct: Math.round(avgComprehension(lastTrials)),
      };
    }
  }

  return {
    hasAnyData: trainedTasks.length > 0 || reading !== null,
    trainedTasks,
    reading,
  };
}

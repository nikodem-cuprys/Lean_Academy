import { prisma } from "@lean-academy/db";
import { TASK_BOUNDS } from "./task-bounds";
import { actualWpmFromMetadata } from "./progress-data";
import { NEAR_TRANSFER_ASSESSMENT_INTERVAL_DAYS } from "./near-transfer-assessment";

/**
 * Real data for the Longitudinal trend view (docs/kanban.md's Phase 6
 * "Longitudinal trend view" card) — one point per real training session,
 * sourced from Trial rows the same way progress-data.ts is, but as a
 * genuine multi-point time series rather than a single before/after
 * comparison. Premium-only (see apps/web/src/app/progress/trends/page.tsx)
 * — docs/monetization-plan.md lists "deeper statistics"/"advanced...
 * analytics" as premium, and the free tier's Progress page already shows
 * a real (if simpler) 30-day snapshot for the same underlying data.
 */

const READING_METHOD = "reading-paced-adaptive-v0";

/**
 * A trend needs enough real, spread-out data to not be misleading — a
 * handful of sessions crammed into a couple of days would draw a
 * technically-real but statistically meaningless zigzag, and
 * docs/development-plan.md's own Phase 6 dependency line says this
 * specific feature needs "weeks" of data, not days. The 14-day span
 * reuses near-transfer-assessment.ts's existing real-calendar-day
 * convention rather than inventing a second arbitrary number; the
 * session-count floor is paired with it so two sessions 14 days apart
 * (still just a straight line between two points) doesn't count either.
 */
export const TREND_MIN_SESSIONS = 5;
export const TREND_MIN_SPAN_DAYS = NEAR_TRANSFER_ASSESSMENT_INTERVAL_DAYS;

export interface TrendPoint {
  /** ISO string — crosses into a client component, and Date objects aren't safely serializable across the RSC boundary (same reason near-transfer-assessment.ts's takenAt is a string). */
  date: string;
  value: number;
}

export type TrendDomain = "WORKING_MEMORY" | "READING" | "SPATIAL";

export interface TaskTrend {
  method: string;
  displayName: string;
  domain: TrendDomain;
  points: TrendPoint[];
  hasEnoughData: boolean;
  sessionCount: number;
  spanDays: number;
  min: number;
  max: number;
}

export interface ReadingTrend {
  wpmPoints: TrendPoint[];
  comprehensionPoints: TrendPoint[];
  hasEnoughData: boolean;
  sessionCount: number;
  spanDays: number;
}

export interface TrendData {
  taskTrends: TaskTrend[];
  reading: ReadingTrend | null;
}

function spanDaysBetween(firstMs: number, lastMs: number): number {
  return (lastMs - firstMs) / (24 * 60 * 60 * 1000);
}

interface TrialRow {
  difficultyAtTrial: number;
  trainingSessionId: string;
  stimulusStartedAt: Date;
  correct: boolean;
  metadata: unknown;
}

/** Groups trials into one real session's worth each, ordered by when that session happened. */
function groupBySession(trials: TrialRow[]): TrialRow[][] {
  const bySession = new Map<string, TrialRow[]>();
  for (const t of trials) {
    const list = bySession.get(t.trainingSessionId);
    if (list) list.push(t);
    else bySession.set(t.trainingSessionId, [t]);
  }
  return Array.from(bySession.values()).sort(
    (a, b) => a[0].stimulusStartedAt.getTime() - b[0].stimulusStartedAt.getTime()
  );
}

export async function getTrendData(userId: string): Promise<TrendData> {
  const difficultyStates = await prisma.difficultyState.findMany({
    where: { userId },
    include: { taskVersion: { include: { taskDefinition: true } } },
  });

  const taskTrends: TaskTrend[] = [];
  let reading: ReadingTrend | null = null;

  for (const ds of difficultyStates) {
    const { method, displayName, domain } = ds.taskVersion.taskDefinition;

    const trials = await prisma.trial.findMany({
      where: { taskVersionId: ds.taskVersionId, trainingSession: { userId } },
      orderBy: { stimulusStartedAt: "asc" },
      select: { difficultyAtTrial: true, trainingSessionId: true, stimulusStartedAt: true, correct: true, metadata: true },
    });
    if (trials.length === 0) continue;

    const sessions = groupBySession(trials);
    const sessionCount = sessions.length;
    const firstMs = sessions[0][0].stimulusStartedAt.getTime();
    const lastMs = sessions[sessionCount - 1][0].stimulusStartedAt.getTime();
    const spanDays = sessionCount > 1 ? spanDaysBetween(firstMs, lastMs) : 0;
    const hasEnoughData = sessionCount >= TREND_MIN_SESSIONS && spanDays >= TREND_MIN_SPAN_DAYS;

    if (method === READING_METHOD) {
      const wpmPoints: TrendPoint[] = [];
      const comprehensionPoints: TrendPoint[] = [];
      for (const sessionTrials of sessions) {
        const date = sessionTrials[0].stimulusStartedAt.toISOString();
        const wpmValues = sessionTrials
          .map((t) => actualWpmFromMetadata(t.metadata))
          .filter((v): v is number => v !== null);
        if (wpmValues.length > 0) {
          wpmPoints.push({ date, value: Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length) });
        }
        const comprehensionPct = (sessionTrials.filter((t) => t.correct).length / sessionTrials.length) * 100;
        comprehensionPoints.push({ date, value: Math.round(comprehensionPct) });
      }
      reading = { wpmPoints, comprehensionPoints, hasEnoughData, sessionCount, spanDays: Math.round(spanDays) };
      continue;
    }

    const bounds = TASK_BOUNDS[method];
    const points: TrendPoint[] = sessions.map((sessionTrials) => ({
      date: sessionTrials[0].stimulusStartedAt.toISOString(),
      // The session's own LAST trial for this task — the difficulty the
      // adaptive engine actually left the user at when that session
      // ended, not the level they started it at.
      value: sessionTrials[sessionTrials.length - 1].difficultyAtTrial,
    }));
    taskTrends.push({
      method,
      displayName,
      domain: domain as TrendDomain,
      points,
      hasEnoughData,
      sessionCount,
      spanDays: Math.round(spanDays),
      min: bounds?.min ?? Math.min(...points.map((p) => p.value)),
      max: bounds?.max ?? Math.max(...points.map((p) => p.value)),
    });
  }

  return { taskTrends, reading };
}

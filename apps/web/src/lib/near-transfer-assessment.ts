import { prisma } from "@lean-academy/db";

/**
 * Shared "periodic" trigger rule for near-transfer assessments
 * (docs/kanban.md's Backward Digit Span / alternate spatial-span
 * cards both need one, and deliberately share it "so a user doesn't
 * get pinged for two separate periodic assessments on different
 * schedules"). Concrete and documented, same pattern as the Streaks
 * card's UTC-day-boundary choice: 14 real calendar days since the
 * user's last AssessmentResult for that specific assessment — a
 * fixed, code-level choice, not left vague. This governs "due" status
 * only; a user can still retake voluntarily before it's due.
 */
export const NEAR_TRANSFER_ASSESSMENT_INTERVAL_DAYS = 14;

/** Real Assessment.name for each near-transfer assessment — the one place each is spelled, shared between its completion route and status lookups. */
export const BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME = "Backward Digit Span";
export const BACKWARD_SPATIAL_SPAN_ASSESSMENT_NAME = "Backward Spatial Span";

export interface NearTransferAssessmentStatus {
  lastTakenAt: Date | null;
  isDue: boolean;
  /** null if never taken (always due in that case). */
  nextDueAt: Date | null;
}

/**
 * @param assessmentName Must match the `name` an assessment-completion
 *   route find-or-creates its real Assessment row under (e.g. "Backward
 *   Digit Span") — see apps/web/src/app/api/assessments/backward-digit-span/route.ts.
 */
export async function getNearTransferAssessmentStatus(
  userId: string,
  assessmentName: string,
  now: Date = new Date()
): Promise<NearTransferAssessmentStatus> {
  const assessment = await prisma.assessment.findFirst({
    where: { type: "NEAR_TRANSFER", name: assessmentName },
  });
  if (!assessment) {
    return { lastTakenAt: null, isDue: true, nextDueAt: null };
  }

  const lastResult = await prisma.assessmentResult.findFirst({
    where: { userId, assessmentId: assessment.id },
    orderBy: { takenAt: "desc" },
  });
  if (!lastResult) {
    return { lastTakenAt: null, isDue: true, nextDueAt: null };
  }

  const nextDueAt = new Date(
    lastResult.takenAt.getTime() + NEAR_TRANSFER_ASSESSMENT_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  );
  return { lastTakenAt: lastResult.takenAt, isDue: now >= nextDueAt, nextDueAt };
}

/**
 * The two near-transfer assessments this app has, each paired with the
 * trained task(s) it's a genuine near-transfer measure *for* (see
 * docs/evidence-review.md §11/§12) — used by the Progress page's
 * "Similar tasks" tab (docs/kanban.md's "Wire Similar Cognitive Tasks
 * to real near-transfer data" card) to know which assessments to look
 * for and how to describe them, without hardcoding a second copy of
 * this list there.
 */
export const NEAR_TRANSFER_ASSESSMENTS = [
  {
    assessmentName: BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME,
    route: "/assessments/backward-digit-span",
    trainedTaskLabel: "your N-Back / Complex Span training",
  },
  {
    assessmentName: BACKWARD_SPATIAL_SPAN_ASSESSMENT_NAME,
    route: "/assessments/backward-spatial-span",
    trainedTaskLabel: "your Spatial Sequence training",
  },
] as const;

export interface NearTransferAssessmentSummary {
  assessmentName: string;
  route: string;
  trainedTaskLabel: string;
  finalSpan: number;
  finalSpanCorrect: number;
  finalSpanTrials: number;
  /** Wilson-score confidence interval on accuracy at the terminal span level — see packages/psychometrics's calculateProportionConfidenceInterval. Not a confidence interval on the span number itself. */
  confidenceIntervalLowerPct: number;
  confidenceIntervalUpperPct: number;
  confidenceLevelPct: number;
  /** ISO string, not a Date — this crosses into a client component (ProgressView), and Date objects aren't safely serializable across the RSC boundary. */
  takenAt: string;
}

function parseBackwardSpanScoreSummary(
  value: unknown
): { finalSpan: number; finalSpanCorrect: number; finalSpanTrials: number; confidenceInterval: { lower: number; upper: number; confidenceLevel: number } } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.finalSpan !== "number" || typeof v.finalSpanCorrect !== "number" || typeof v.finalSpanTrials !== "number") {
    return null;
  }
  const ci = v.confidenceInterval;
  if (!ci || typeof ci !== "object") return null;
  const c = ci as Record<string, unknown>;
  if (typeof c.lower !== "number" || typeof c.upper !== "number" || typeof c.confidenceLevel !== "number") {
    return null;
  }
  return {
    finalSpan: v.finalSpan,
    finalSpanCorrect: v.finalSpanCorrect,
    finalSpanTrials: v.finalSpanTrials,
    confidenceInterval: { lower: c.lower, upper: c.upper, confidenceLevel: c.confidenceLevel },
  };
}

/** The user's most recent real result for each near-transfer assessment they've actually taken — never fabricated for one they haven't. */
export async function getNearTransferAssessmentsSummary(userId: string): Promise<NearTransferAssessmentSummary[]> {
  const summaries: NearTransferAssessmentSummary[] = [];

  for (const config of NEAR_TRANSFER_ASSESSMENTS) {
    const assessment = await prisma.assessment.findFirst({
      where: { type: "NEAR_TRANSFER", name: config.assessmentName },
    });
    if (!assessment) continue;

    const result = await prisma.assessmentResult.findFirst({
      where: { userId, assessmentId: assessment.id },
      orderBy: { takenAt: "desc" },
    });
    if (!result) continue;

    const parsed = parseBackwardSpanScoreSummary(result.scoreSummary);
    if (!parsed) continue; // malformed/unexpected shape — skip rather than show a broken card

    summaries.push({
      assessmentName: config.assessmentName,
      route: config.route,
      trainedTaskLabel: config.trainedTaskLabel,
      finalSpan: parsed.finalSpan,
      finalSpanCorrect: parsed.finalSpanCorrect,
      finalSpanTrials: parsed.finalSpanTrials,
      confidenceIntervalLowerPct: Math.round(parsed.confidenceInterval.lower * 100),
      confidenceIntervalUpperPct: Math.round(parsed.confidenceInterval.upper * 100),
      confidenceLevelPct: Math.round(parsed.confidenceInterval.confidenceLevel * 100),
      takenAt: result.takenAt.toISOString(),
    });
  }

  return summaries;
}

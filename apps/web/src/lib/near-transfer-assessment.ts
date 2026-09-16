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

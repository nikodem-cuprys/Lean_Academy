import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { calculateProportionConfidenceInterval } from "@lean-academy/psychometrics";
import {
  BACKWARD_DIGIT_SPAN_MAX,
  BACKWARD_DIGIT_SPAN_MIN,
} from "@lean-academy/cognitive-engine";
import { auth } from "@/lib/auth";
import { checkFirstAssessmentAchievement } from "@/lib/achievements";
import { syncWeeklyChallengeProgress } from "@/lib/weekly-challenges";
import { BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME } from "@/lib/near-transfer-assessment";

// Real Assessment/AssessmentResult persistence for the Backward Digit
// Span near-transfer assessment (docs/kanban.md's "Near-transfer
// assessment: Backward Digit Span" card) — the client
// (<BackwardDigitSpanAssessment>) runs the whole fixed-staircase
// procedure itself (packages/cognitive-engine's
// BackwardDigitSpanAssessment, no adaptive engine involved) and calls
// this route once, at the end, with the final score — same
// one-write-at-the-end shape as /api/onboarding/complete.

const bodySchema = z.object({
  finalSpan: z.number().int().min(0).max(BACKWARD_DIGIT_SPAN_MAX),
  totalCorrect: z.number().int().min(0),
  totalTrials: z.number().int().min(1),
  finalSpanCorrect: z.number().int().min(0),
  finalSpanTrials: z.number().int().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { finalSpan, totalCorrect, totalTrials, finalSpanCorrect, finalSpanTrials } = parsed.data;
  if (finalSpanCorrect > finalSpanTrials || totalCorrect > totalTrials) {
    return NextResponse.json({ error: "correct count cannot exceed trial count" }, { status: 400 });
  }

  // The confidence interval is computed over the terminal span level's
  // own trials, not the whole staircase — see
  // packages/psychometrics's calculateProportionConfidenceInterval
  // docstring and BackwardDigitSpanScore's own field comments for why.
  const confidenceInterval = calculateProportionConfidenceInterval(finalSpanCorrect, finalSpanTrials);

  let assessment = await prisma.assessment.findFirst({
    where: { type: "NEAR_TRANSFER", name: BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME },
  });
  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        name: BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME,
        type: "NEAR_TRANSFER",
        description:
          "A fixed ascending-span staircase measuring backward digit recall — a near-transfer measure for working-memory training, distinct in task and form from the trained N-Back/Complex Span exercises.",
      },
    });
  }

  const result = await prisma.assessmentResult.create({
    data: {
      assessmentId: assessment.id,
      userId,
      scoreSummary: {
        finalSpan,
        totalCorrect,
        totalTrials,
        finalSpanCorrect,
        finalSpanTrials,
        confidenceInterval: {
          proportion: confidenceInterval.proportion,
          lower: confidenceInterval.lower,
          upper: confidenceInterval.upper,
          confidenceLevel: confidenceInterval.confidenceLevel,
        },
        minPossibleSpan: BACKWARD_DIGIT_SPAN_MIN,
        maxPossibleSpan: BACKWARD_DIGIT_SPAN_MAX,
      },
    },
  });

  await checkFirstAssessmentAchievement(userId);
  await syncWeeklyChallengeProgress(userId);

  return NextResponse.json({ success: true, resultId: result.id, confidenceInterval });
}

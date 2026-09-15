import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";
import { TASK_BOUNDS, type TaskBounds } from "@/lib/task-bounds";
import { checkFirstAssessmentAchievement } from "@/lib/achievements";
import { syncWeeklyChallengeProgress } from "@/lib/weekly-challenges";

// Implements project_prompt.txt's onboarding sequence: "goals ->
// available time -> experience level -> short calibration -> recommended
// level (accept or change) -> first plan." The client (OnboardingFlow)
// runs the whole sequence and only calls this route once, at the very
// end, with everything it collected — this is the one place any of it
// actually hits the database.

// Experience self-report nudges the *auto* starting point by one step
// each way — a light-touch adjustment, not a hard override.
const EXPERIENCE_DELTA: Record<string, number> = { new: -1, some: 0, experienced: 1 };
const EXPERIENCE_LABELS: Record<string, string> = {
  new: "New to this",
  some: "Some experience",
  experienced: "Very experienced",
};

/**
 * Maps the plain-language level the user accepted or chose (never a raw
 * internal Difficulty number, per CLAUDE.md's difficulty-display rule)
 * to this specific task's actual starting difficulty. AUTO trusts the
 * calibration + experience-adjusted number as measured; the named tiers
 * override it with a fixed point on this task's own min-max range.
 */
function levelToDifficulty(level: string, bounds: TaskBounds, autoValue: number): number {
  switch (level) {
    case "BEGINNER":
      return bounds.min;
    case "INTERMEDIATE":
      return bounds.default;
    case "ADVANCED":
      return Math.round((bounds.default + bounds.max) / 2);
    case "EXPERT":
      return bounds.max;
    default: // AUTO (and CUSTOM, not offered at onboarding — falls back safely)
      return autoValue;
  }
}

const onboardingSchema = z.object({
  goal: z.enum(["working-memory", "concentration", "reading-efficiency", "memory-strategies", "habit", "balanced"]),
  dailyMinutes: z.number().int().min(1).max(180),
  experienceLevel: z.enum(["new", "some", "experienced"]),
  difficultyLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "AUTO"]),
  calibration: z.array(
    z.object({
      method: z.enum([
        "adaptive-nback-v0",
        "complex-span-v0",
        "visuospatial-sequence-recall-v0",
        "reading-paced-adaptive-v0",
      ]),
      correct: z.number().int().min(0),
      total: z.number().int().min(0),
    })
  ),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { goal, dailyMinutes, experienceLevel, difficultyLevel, calibration } = parsed.data;
  const experienceDelta = EXPERIENCE_DELTA[experienceLevel];

  await prisma.trainingPlan.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });
  await prisma.trainingPlan.create({
    data: {
      userId,
      goals: [goal],
      experienceLevel: EXPERIENCE_LABELS[experienceLevel],
      difficultyLevel,
      active: true,
    },
  });

  await prisma.dailyGoal.upsert({
    where: { userId },
    create: { userId, targetMinutes: dailyMinutes },
    update: { targetMinutes: dailyMinutes },
  });

  for (const result of calibration) {
    const bounds = TASK_BOUNDS[result.method];
    const definition = await prisma.taskDefinition.findUnique({
      where: { method: result.method },
      include: { versions: { orderBy: { releasedAt: "desc" }, take: 1 } },
    });
    const taskVersion = definition?.versions[0];
    if (!taskVersion) continue; // seed hasn't run for this task — skip rather than fail the whole request

    const autoValue = Math.min(bounds.max, Math.max(bounds.min, bounds.default + experienceDelta));
    const currentDifficulty = levelToDifficulty(difficultyLevel, bounds, autoValue);

    await prisma.difficultyState.upsert({
      where: { userId_taskVersionId: { userId, taskVersionId: taskVersion.id } },
      create: { userId, taskVersionId: taskVersion.id, currentDifficulty },
      update: { currentDifficulty },
    });
  }

  let assessment = await prisma.assessment.findFirst({
    where: { type: "BASELINE", name: "Baseline Calibration" },
  });
  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        name: "Baseline Calibration",
        type: "BASELINE",
        description: "The short mixed-domain calibration run at the end of onboarding.",
      },
    });
  }
  await prisma.assessmentResult.create({
    data: { assessmentId: assessment.id, userId, scoreSummary: calibration },
  });
  await checkFirstAssessmentAchievement(userId);
  await syncWeeklyChallengeProgress(userId);

  return NextResponse.json({ success: true });
}

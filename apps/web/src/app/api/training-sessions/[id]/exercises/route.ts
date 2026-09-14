import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";
import { checkExerciseAchievements } from "@/lib/achievements";

// Called once per exercise completion during a training session (see
// TrainingSessionRunner) — persists that exercise's real Trial rows and
// advances the user's DifficultyState for that task, continuing from
// wherever the session started rather than resetting each time.

const trialSchema = z.object({
  correct: z.boolean(),
  reactionTimeMs: z.number().optional(),
  stimulusStartedAtMs: z.number(),
  respondedAtMs: z.number().optional(),
  wasInterrupted: z.boolean(),
  difficultyAtTrial: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.object({
  method: z.string(),
  startDifficulty: z.number().int(),
  endDifficulty: z.number().int(),
  trials: z.array(trialSchema),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id } });
  if (!trainingSession || trainingSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Training session not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { method, startDifficulty, endDifficulty, trials } = parsed.data;

  const definition = await prisma.taskDefinition.findUnique({
    where: { method },
    include: { versions: { orderBy: { releasedAt: "desc" }, take: 1 } },
  });
  const taskVersion = definition?.versions[0];
  if (!taskVersion) {
    return NextResponse.json({ error: `No TaskVersion for method "${method}".` }, { status: 400 });
  }

  if (trials.length > 0) {
    await prisma.trial.createMany({
      data: trials.map((t) => ({
        trainingSessionId: id,
        taskVersionId: taskVersion.id,
        difficultyAtTrial: t.difficultyAtTrial,
        correct: t.correct,
        reactionTimeMs: t.reactionTimeMs,
        stimulusStartedAt: new Date(t.stimulusStartedAtMs),
        respondedAt: t.respondedAtMs !== undefined ? new Date(t.respondedAtMs) : undefined,
        wasInterrupted: t.wasInterrupted,
        metadata: t.metadata as Prisma.InputJsonValue | undefined,
      })),
    });
  }

  await prisma.difficultyState.upsert({
    where: { userId_taskVersionId: { userId: session.user.id, taskVersionId: taskVersion.id } },
    create: { userId: session.user.id, taskVersionId: taskVersion.id, currentDifficulty: endDifficulty },
    update: { currentDifficulty: endDifficulty },
  });

  await checkExerciseAchievements({
    userId: session.user.id,
    method,
    domain: definition!.domain,
    taskVersionId: taskVersion.id,
    trainingSessionId: id,
    startDifficulty,
    endDifficulty,
    sessionCorrect: trials.filter((t) => t.correct).length,
    sessionTotal: trials.length,
  });

  return NextResponse.json({ success: true });
}

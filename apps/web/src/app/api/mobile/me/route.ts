import { NextResponse } from "next/server";
import { prisma } from "@lean-academy/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { getStreakStatus } from "@/lib/streak";
import { getTrainingLevelStatus } from "@/lib/xp";

// The Android app's Home screen data, read from the same rows the web's
// Home and /progress read, so progress made on either client shows up on
// the other immediately. `onboarded` mirrors getTodaysTraining's rule:
// no DifficultyState rows at all means onboarding/calibration hasn't
// happened yet, and the app sends the user to the web to do it rather
// than guessing a starting level.
export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, locale: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [difficultyStates, streak, trainingLevel, nBackTrialCount] = await Promise.all([
    prisma.difficultyState.findMany({
      where: { userId },
      include: { taskVersion: { include: { taskDefinition: true } } },
    }),
    getStreakStatus(userId),
    getTrainingLevelStatus(userId),
    prisma.trial.count({
      where: {
        trainingSession: { userId },
        taskVersion: { taskDefinition: { method: "adaptive-nback-v0" } },
        wasInterrupted: false,
      },
    }),
  ]);

  const nBackState = difficultyStates.find(
    (ds) => ds.taskVersion.taskDefinition.method === "adaptive-nback-v0"
  );

  return NextResponse.json({
    user,
    onboarded: difficultyStates.length > 0,
    streak,
    trainingLevel,
    nBack: nBackState
      ? { currentDifficulty: nBackState.currentDifficulty, scoredTrials: nBackTrialCount }
      : null,
  });
}

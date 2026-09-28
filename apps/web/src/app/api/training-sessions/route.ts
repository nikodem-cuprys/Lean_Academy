import { NextResponse } from "next/server";
import { prisma } from "@lean-academy/db";
import { getRequestUserId } from "@/lib/mobile-auth";

// Starts a new TrainingSession — the first call the session runner
// makes, before running any exercise. Kept intentionally minimal (no
// body): the exercise list itself comes from getTodaysTraining, computed
// server-side by the page that renders the runner.
export async function POST(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const trainingPlan = await prisma.trainingPlan.findFirst({
    where: { userId, active: true },
  });

  const trainingSession = await prisma.trainingSession.create({
    data: {
      userId,
      trainingPlanId: trainingPlan?.id,
    },
  });

  return NextResponse.json({ id: trainingSession.id }, { status: 201 });
}

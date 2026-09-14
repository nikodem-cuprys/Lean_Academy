import { NextResponse } from "next/server";
import { prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";

// Starts a new TrainingSession — the first call the session runner
// makes, before running any exercise. Kept intentionally minimal (no
// body): the exercise list itself comes from getTodaysTraining, computed
// server-side by the page that renders the runner.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const trainingPlan = await prisma.trainingPlan.findFirst({
    where: { userId: session.user.id, active: true },
  });

  const trainingSession = await prisma.trainingSession.create({
    data: {
      userId: session.user.id,
      trainingPlanId: trainingPlan?.id,
    },
  });

  return NextResponse.json({ id: trainingSession.id }, { status: 201 });
}

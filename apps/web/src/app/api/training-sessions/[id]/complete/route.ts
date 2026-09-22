import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";
import { recordActiveDayForStreak } from "@/lib/streak";
import { checkSessionCompletionAchievements } from "@/lib/achievements";
import { recordSessionCompletionXp } from "@/lib/xp";
import { syncWeeklyChallengeProgress } from "@/lib/weekly-challenges";
import { syncDailyQuestProgress } from "@/lib/daily-quests";

const bodySchema = z.object({
  totalDurationSeconds: z.number().int().min(0),
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

  await prisma.trainingSession.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      totalDurationSeconds: parsed.data.totalDurationSeconds,
    },
  });

  const streak = await recordActiveDayForStreak(session.user.id);
  await checkSessionCompletionAchievements(session.user.id, streak.currentStreakDays);
  const xp = await recordSessionCompletionXp(session.user.id, id, streak.currentStreakDays);
  await syncWeeklyChallengeProgress(session.user.id);
  await syncDailyQuestProgress(session.user.id);

  return NextResponse.json({ success: true, streak, xp });
}

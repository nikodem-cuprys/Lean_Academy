import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { recordActiveDayForStreak } from "@/lib/streak";
import { checkSessionCompletionAchievements } from "@/lib/achievements";
import { recordSessionCompletionXp } from "@/lib/xp";
import { syncWeeklyChallengeProgress } from "@/lib/weekly-challenges";
import { syncDailyQuestProgress } from "@/lib/daily-quests";

const bodySchema = z.object({
  totalDurationSeconds: z.number().int().min(0),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id } });
  if (!trainingSession || trainingSession.userId !== userId) {
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

  const streak = await recordActiveDayForStreak(userId);
  await checkSessionCompletionAchievements(userId, streak.currentStreakDays);
  const xp = await recordSessionCompletionXp(userId, id, streak.currentStreakDays);
  await syncWeeklyChallengeProgress(userId);
  await syncDailyQuestProgress(userId);

  return NextResponse.json({ success: true, streak, xp });
}

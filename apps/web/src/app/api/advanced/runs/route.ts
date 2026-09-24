import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ADVANCED_METHODS } from "@/lib/advanced-settings";
import { recordAdvancedRun } from "@/lib/advanced-runs";

// Records one completed Advanced-tab lesson into AdvancedRun only —
// never TrainingSession/Trial/DifficultyState/XpEntry. See
// apps/web/src/lib/advanced-settings.ts for why.

const bodySchema = z
  .object({
    method: z.enum(ADVANCED_METHODS),
    settings: z.record(z.string(), z.union([z.number(), z.boolean()])),
    trialCount: z.number().int().min(0).max(500),
    correctCount: z.number().int().min(0).max(500),
    startLevel: z.number().int().min(1).max(1000),
    endLevel: z.number().int().min(1).max(1000),
    averageWpm: z.number().min(0).max(5000).optional(),
  })
  .refine((b) => b.correctCount <= b.trialCount, { message: "correctCount cannot exceed trialCount" });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await recordAdvancedRun(session.user.id, parsed.data);
  return NextResponse.json({ success: true }, { status: 201 });
}

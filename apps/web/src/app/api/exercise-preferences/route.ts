import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  PACE_PRESETS,
  PACED_METHODS,
  DIE_SIDES_OPTIONS,
  DICE_METHOD,
  setPacePreference,
  setDieSidesPreference,
} from "@/lib/exercise-preferences";

// Backs the /settings/exercises page — one real, free preference write
// per exercise (see exercise-preferences.ts's own header for the scope
// decision). A paced exercise (N-Back/Complex Span/Spatial Sequence)
// sends { method, pace }; Dice Sum sends { method: "dice-sum-v0",
// dieSides }.

const dieSidesSchema = z
  .number()
  .refine((n): n is (typeof DIE_SIDES_OPTIONS)[number] => (DIE_SIDES_OPTIONS as readonly number[]).includes(n), {
    message: `dieSides must be one of ${DIE_SIDES_OPTIONS.join(", ")}`,
  });

const bodySchema = z.union([
  z.object({ method: z.enum(PACED_METHODS), pace: z.enum(PACE_PRESETS) }),
  z.object({ method: z.literal(DICE_METHOD), dieSides: dieSidesSchema }),
]);

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if ("pace" in parsed.data) {
    await setPacePreference(session.user.id, parsed.data.method, parsed.data.pace);
  } else {
    await setDieSidesPreference(session.user.id, parsed.data.dieSides);
  }

  return NextResponse.json({ success: true });
}

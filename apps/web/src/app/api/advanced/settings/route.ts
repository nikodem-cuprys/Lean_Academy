import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ADVANCED_METHODS } from "@/lib/advanced-settings";
import { setAdvancedSettings } from "@/lib/advanced-runs";

// Saves one exercise's Advanced-tab parameters. The settings object is
// deliberately loosely typed here: setAdvancedSettings runs it through
// sanitizeAdvancedSettings, which drops unknown keys and clamps every
// value into its spec's range, and the sanitized result is echoed back
// so the client can show exactly what was stored.

const bodySchema = z.object({
  method: z.enum(ADVANCED_METHODS),
  settings: z.record(z.string(), z.union([z.number(), z.boolean()])),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await setAdvancedSettings(session.user.id, parsed.data.method, parsed.data.settings);
  return NextResponse.json({ settings });
}

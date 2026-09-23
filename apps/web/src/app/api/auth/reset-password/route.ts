import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@lean-academy/db";
import { consumePasswordResetToken } from "@/lib/tokens";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const t = await getTranslations("apiErrors");
  const schema = z.object({
    email: z.string().email(t("invalidEmail")),
    token: z.string().min(1),
    password: z.string().min(8, t("passwordTooShort")),
  });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { email, token, password } = parsed.data;

  // Limits brute-forcing the token itself, separately from the
  // request-a-link endpoint's limiter.
  if (isRateLimited(`reset-password:${email}`, { max: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: t("tooManyAttempts") },
      { status: 429 }
    );
  }

  const result = await consumePasswordResetToken(email, token);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? t("resetExpired")
            : t("resetInvalid"),
      },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const now = new Date();
  await prisma.user.update({
    where: { email },
    data: { hashedPassword, passwordChangedAt: now },
  });

  // Sessions use the JWT strategy (no server-side session store), so
  // apps/web/src/lib/auth.ts's `jwt` callback is the actual revocation
  // mechanism: it rejects any token whose `iat` predates
  // passwordChangedAt, signing out every other device on its next request.

  return NextResponse.json({ ok: true });
}

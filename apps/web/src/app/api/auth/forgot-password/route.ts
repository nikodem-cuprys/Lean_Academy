import { NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@lean-academy/db";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

// Always returns the same generic response regardless of whether the
// email is registered, has a password at all (vs. OAuth-only), or the
// send succeeds — an attacker must not be able to use this endpoint to
// discover which emails have accounts. Real failures are logged, not
// surfaced to the caller.
export async function POST(request: Request) {
  const t = await getTranslations("apiErrors");
  const GENERIC_RESPONSE = { message: t("resetGeneric") };

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("invalidEmail") }, { status: 400 });
  }
  const { email } = parsed.data;

  if (isRateLimited(`forgot-password:${email}`, { max: 3, windowMs: 15 * 60 * 1000 })) {
    // Same generic response even when rate-limited — don't reveal that
    // this address has been requested repeatedly.
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.hashedPassword) {
    try {
      const token = await createPasswordResetToken(email);
      // In the account's own saved language, not the requester's —
      // same generic response either way, so this leaks nothing.
      await sendPasswordResetEmail(email, token, user.locale);
    } catch (err) {
      console.error("Failed to send password reset email:", err);
    }
  }
  // If the user doesn't exist, or exists but is OAuth-only (no
  // hashedPassword — resetting a password they don't have makes no
  // sense), silently do nothing except return the same response.

  return NextResponse.json(GENERIC_RESPONSE);
}

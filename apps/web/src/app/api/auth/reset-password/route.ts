import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { consumePasswordResetToken } from "@/lib/tokens";
import { isRateLimited } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
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
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const result = await consumePasswordResetToken(email, token);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "This reset link has expired. Request a new one."
            : "This reset link isn't valid.",
      },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { email }, data: { hashedPassword } });

  // Note: sessions use the JWT strategy, so this does not invalidate any
  // session already issued on another device — a real hardening pass
  // would move to database sessions or a token-revocation list to close
  // that gap.

  return NextResponse.json({ ok: true });
}

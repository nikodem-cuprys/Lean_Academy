import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@lean-academy/db";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Error messages come back already in the requester's language —
  // AuthForm shows them verbatim.
  const t = await getTranslations("apiErrors");
  const registerSchema = z.object({
    email: z.string().email(t("invalidEmail")),
    password: z.string().min(8, t("passwordTooShort")),
    name: z.string().min(1).optional(),
  });

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { email, password, name } = parsed.data;

  // Each successful attempt sends a real verification email (see below)
  // — this bounds both mass-account-creation abuse and email-bombing a
  // single address, the same concern forgot-password's limiter guards
  // against.
  if (isRateLimited(`register:${email}`, { max: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: t("tooManyAttempts") },
      { status: 429 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: t("accountExists") },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  // The language they signed up in becomes the account's saved language
  // (see User.locale) — used on new devices and for later emails.
  const locale = await getLocale();
  const user = await prisma.user.create({
    data: { email, name, hashedPassword, locale },
  });

  let emailSent = true;
  try {
    const token = await createVerificationToken(email);
    await sendVerificationEmail(email, token, locale);
  } catch (err) {
    // The account is real either way — don't roll it back just because
    // mail delivery failed (e.g. maildev isn't running locally). Surface
    // it in the response so the UI can say something honest instead of
    // implying an email that never sent.
    console.error("Failed to send verification email:", err);
    emailSent = false;
  }

  return NextResponse.json(
    { id: user.id, email: user.email, emailSent },
    { status: 201 }
  );
}

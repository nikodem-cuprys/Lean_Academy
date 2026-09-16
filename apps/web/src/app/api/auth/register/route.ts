import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { createVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
});

export async function POST(request: Request) {
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
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, hashedPassword },
  });

  let emailSent = true;
  try {
    const token = await createVerificationToken(email);
    await sendVerificationEmail(email, token);
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

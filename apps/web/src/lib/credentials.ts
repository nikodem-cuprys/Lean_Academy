import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@lean-academy/db";
import { isRateLimited } from "@/lib/rate-limit";

// The one email+password check, shared by Auth.js's Credentials provider
// (web, src/lib/auth.ts) and /api/mobile/auth/login (the Android app), so
// the two sign-in paths can't drift apart on rate limiting or on what
// counts as a valid login.

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export interface VerifiedUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  locale: string | null;
}

/** Returns the user, or null for every failure — see the comments below for why they're indistinguishable. */
export async function verifyCredentials(rawCredentials: unknown): Promise<VerifiedUser | null> {
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  // Same generic "invalid credentials" outcome (null) as a wrong
  // password below — a rate-limited attempt must not be
  // distinguishable from a bad password, or it leaks that this
  // email is being brute-forced. See docs/security.md's
  // rate-limiting requirement.
  if (isRateLimited(`login:${email}`, { max: 10, windowMs: 15 * 60 * 1000 })) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // No hashedPassword means this account is OAuth-only — don't
  // treat "no password set" as an auth failure worth distinguishing
  // from "wrong password" in the response (avoid leaking which).
  if (!user?.hashedPassword) return null;

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    locale: user.locale,
  };
}

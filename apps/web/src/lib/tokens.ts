import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@lean-academy/db";

// Reuses Auth.js's standard VerificationToken table for two custom
// purposes it wasn't originally built for (email verification and
// password reset) rather than adding new tables — the `identifier`
// field is prefixed by purpose ("verify:"/"reset:" + email) so the two
// flows can't be confused with each other. This is a documented,
// low-risk pattern for extending the Auth.js Prisma adapter schema.
//
// Tokens are stored hashed (SHA-256), never in plaintext — only the raw
// token is ever emailed, and it's discarded once verified.

const VERIFY_PREFIX = "verify:";
const RESET_PREFIX = "reset:";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function issueToken(
  identifier: string,
  ttlMs: number
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs);

  // A user requesting a new link twice shouldn't leave two valid tokens
  // alive — invalidate any previous ones for this identifier first.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(rawToken), expires },
  });

  return rawToken;
}

export function createVerificationToken(email: string): Promise<string> {
  return issueToken(VERIFY_PREFIX + email, VERIFY_TTL_MS);
}

export function createPasswordResetToken(email: string): Promise<string> {
  return issueToken(RESET_PREFIX + email, RESET_TTL_MS);
}

type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Verifies a raw token against the stored hash for the given identifier
 * and, if valid, deletes it (single-use). Callers are responsible for
 * applying whatever the token authorizes (setting emailVerified,
 * updating hashedPassword, ...) — this only handles the token lifecycle.
 */
async function consumeToken(
  identifier: string,
  rawToken: string
): Promise<ConsumeResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record || record.identifier !== identifier) {
    return { ok: false, reason: "invalid" };
  }

  // Always delete on a matching lookup, valid or not — an expired token
  // should not remain usable-looking for a retry.
  await prisma.verificationToken.delete({ where: { token: record.token } });

  if (record.expires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

export function consumeVerificationToken(
  email: string,
  rawToken: string
): Promise<ConsumeResult> {
  return consumeToken(VERIFY_PREFIX + email, rawToken);
}

export function consumePasswordResetToken(
  email: string,
  rawToken: string
): Promise<ConsumeResult> {
  return consumeToken(RESET_PREFIX + email, rawToken);
}

import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@lean-academy/db";
import { auth } from "@/lib/auth";

// Bearer tokens for the Android app (apps/mobile). A native app can't
// sensibly carry Auth.js's cookie session, so /api/mobile/auth/login
// issues a signed JWT that the app keeps in the OS keystore
// (expo-secure-store) and sends as `Authorization: Bearer ...`.
//
// It's the same account and the same rows as the web session — only
// the transport differs. The signing key is derived from NEXTAUTH_SECRET
// under a distinct label, and the token carries its own audience, so a
// mobile token can never be replayed as an Auth.js session cookie (or
// the other way round). Password-reset invalidation works the same way
// auth.ts's jwt callback does it: any token issued before
// User.passwordChangedAt is rejected.

const AUDIENCE = "lean-academy-mobile";
const TOKEN_LIFETIME = "30d";

function signingKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return createHash("sha256").update(`lean-academy-mobile-token:${secret}`).digest();
}

export async function issueMobileToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(signingKey());
}

async function userIdFromBearer(header: string): Promise<string | null> {
  const token = header.slice("Bearer ".length).trim();
  try {
    const { payload } = await jwtVerify(token, signingKey(), { audience: AUDIENCE, algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.iat !== "number") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordChangedAt: true },
    });
    if (!user) return null;
    // `iat` is whole seconds, so compare at that resolution: in
    // milliseconds, a token issued in the same second as the reset (a
    // sign-in straight after resetting) would read as older than the
    // reset and stay rejected for its whole lifetime.
    if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * The signed-in user for a route both clients call: a mobile bearer
 * token if the request has one, otherwise the web's Auth.js session.
 * A request that sends a bearer token is judged on that token alone —
 * an invalid one is not silently rescued by a cookie.
 */
export async function getRequestUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return userIdFromBearer(header);
  const session = await auth();
  return session?.user?.id ?? null;
}

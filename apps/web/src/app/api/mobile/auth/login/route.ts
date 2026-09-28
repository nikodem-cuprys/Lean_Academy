import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/credentials";
import { issueMobileToken } from "@/lib/mobile-auth";

// Email+password sign-in for the Android app (apps/mobile). Same check,
// same rate limit and same generic failure as the web's Credentials
// provider (src/lib/credentials.ts); the only difference is that it
// answers with a bearer token instead of setting a session cookie. See
// src/lib/mobile-auth.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const user = await verifyCredentials(body);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await issueMobileToken(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, locale: user.locale },
  });
}

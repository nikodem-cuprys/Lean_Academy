import { test, expect, type APIRequestContext } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { createPasswordResetToken } from "../src/lib/tokens";

// Verifies docs/kanban.md's "Invalidate other sessions on password reset"
// card: sessions use Auth.js's JWT strategy (no server-side session
// store), so apps/web/src/lib/auth.ts's `jwt` callback rejects any
// session token whose `iat` predates User.passwordChangedAt, which
// apps/web/src/app/api/auth/reset-password/route.ts now stamps.
//
// Uses the real POST /api/auth/reset-password route and the real
// createPasswordResetToken (apps/web/src/lib/tokens.ts) to get a real,
// correctly-hashed-and-stored token — the same function
// forgot-password's route calls — without needing a running SMTP/maildev
// instance in the test environment, the same "direct call to a real
// production function" pattern already used elsewhere in this suite
// (see e.g. personal-bests.spec.ts) for a step that would otherwise need
// an external dependency this suite doesn't manage.

async function loginViaCredentials(
  ctx: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const res = await ctx.post("/api/auth/callback/credentials", {
    form: { email, password, csrfToken, json: "true" },
    maxRedirects: 0,
  });
  return res.headers()["location"] ?? "";
}

test.describe("Session invalidation on password reset", () => {
  const email = `e2e-session-invalidation-${Date.now()}@example.com`;
  const oldPassword = "correcthorsebattery123";
  const newPassword = "newpassword456";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("resetting a password signs out an existing session and blocks the old password, without locking out the new one", async ({
    page,
    request,
  }) => {
    const registerRes = await page.request.post("/api/auth/register", {
      data: { email, password: oldPassword },
    });
    expect(registerRes.status()).toBe(201);

    // "Device A" — a real session established via the page's own cookie jar.
    const loginLocation = await loginViaCredentials(page.request, email, oldPassword);
    expect(loginLocation).not.toContain("error=CredentialsSignin");

    const sessionBefore = await (await page.request.get("/api/auth/session")).json();
    expect(sessionBefore?.user?.email).toBe(email);

    const rawToken = await createPasswordResetToken(email);
    const resetRes = await page.request.post("/api/auth/reset-password", {
      data: { email, token: rawToken, password: newPassword },
    });
    expect(resetRes.status()).toBe(200);

    // Device A's session predates passwordChangedAt — the very next
    // request must come back unauthenticated, not merely at next expiry.
    const sessionAfter = await (await page.request.get("/api/auth/session")).json();
    expect(sessionAfter).toBeNull();

    // The old password no longer works anywhere...
    const oldPasswordLocation = await loginViaCredentials(request, email, oldPassword);
    expect(oldPasswordLocation).toContain("error=CredentialsSignin");

    // ...but the new one logs in cleanly — no chicken-and-egg lockout
    // from resetting your own password.
    const newPasswordLocation = await loginViaCredentials(request, email, newPassword);
    expect(newPasswordLocation).not.toContain("error=CredentialsSignin");
  });
});

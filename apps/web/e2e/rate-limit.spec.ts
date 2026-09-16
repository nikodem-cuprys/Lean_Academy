import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Verifies docs/kanban.md's "Broaden rate limiting beyond
// forgot-password/reset-password" card: apps/web/src/lib/rate-limit.ts's
// limiter is now also applied to POST /api/auth/register (route-level)
// and the credentials Auth.js provider's authorize() (login), per
// docs/security.md's "rate limiting on login, password reset, and
// registration" requirement.

test.describe("Auth rate limiting", () => {
  const registerEmail = `e2e-ratelimit-register-${Date.now()}@example.com`;
  const loginEmail = `e2e-ratelimit-login-${Date.now()}@example.com`;
  const controlEmail = `e2e-ratelimit-control-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [registerEmail, loginEmail, controlEmail] } },
    });
  });

  test("POST /api/auth/register is rate-limited per email after repeated attempts", async ({
    page,
  }) => {
    // First call actually creates the account (201); every call after
    // that returns 409 ("already exists") but still counts against the
    // limiter, since the check runs before the existing-user lookup —
    // each non-201 attempt would otherwise still trigger a verification
    // email send if it didn't (see the route's own comment).
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await page.request.post("/api/auth/register", {
        data: { email: registerEmail, password },
      });
      statuses.push(res.status());
    }

    expect(statuses[0]).toBe(201);
    for (let i = 1; i < 5; i++) {
      expect(statuses[i]).toBe(409);
    }
    // The 6th call is the 6th attempt against a max of 5 in the window.
    expect(statuses[5]).toBe(429);
  });

  test("credentials login is rate-limited per email — a correct password is blocked after repeated failures", async ({
    page,
  }) => {
    const createRes = await page.request.post("/api/auth/register", {
      data: { email: loginEmail, password },
    });
    expect(createRes.status()).toBe(201);

    async function attemptLogin(attemptPassword: string) {
      const csrfRes = await page.request.get("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      const res = await page.request.post("/api/auth/callback/credentials", {
        form: {
          email: loginEmail,
          password: attemptPassword,
          csrfToken,
          json: "true",
        },
        maxRedirects: 0,
      });
      return res.headers()["location"] ?? "";
    }

    // Exhaust the 10-attempt window with a wrong password — every one
    // fails with the same generic CredentialsSignin error.
    for (let i = 0; i < 10; i++) {
      const location = await attemptLogin("wrong-password");
      expect(location).toContain("error=CredentialsSignin");
    }

    // The 11th attempt uses the *correct* password. If the limiter
    // weren't engaged this would redirect to a session-bearing success
    // URL; instead it must fail identically to a wrong password —
    // proving the limiter, not the password, is what's blocking it.
    const location = await attemptLogin(password);
    expect(location).toContain("error=CredentialsSignin");

    // Control: a different, never-attempted email can still log in
    // normally with its correct password in the same test run — the
    // limiter is scoped per email, not applied globally.
    const controlCreate = await page.request.post("/api/auth/register", {
      data: { email: controlEmail, password },
    });
    expect(controlCreate.status()).toBe(201);

    const csrfRes = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    const controlRes = await page.request.post(
      "/api/auth/callback/credentials",
      {
        form: { email: controlEmail, password, csrfToken, json: "true" },
        maxRedirects: 0,
      }
    );
    const controlLocation = controlRes.headers()["location"] ?? "";
    expect(controlLocation).not.toContain("error=CredentialsSignin");
  });
});

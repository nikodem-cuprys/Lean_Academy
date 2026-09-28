import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { createPasswordResetToken } from "../src/lib/tokens";

// The Android app's (apps/mobile) path through the real API, exercised
// here with plain HTTP requests exactly as the app makes them: bearer
// token from /api/mobile/auth/login (src/lib/mobile-auth.ts), Home data
// from /api/mobile/me, and a run saved through the same three
// /api/training-sessions/* routes the web's TrainingSessionRunner uses.
// No cookies are involved anywhere — every request uses a fresh,
// cookie-less context so a web session can't be what's authorising it.

test.describe("Mobile API (bearer-token auth)", () => {
  const email = `e2e-mobile-api-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";
  const newPassword = "newpassword456";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("login, read home data, save an N-Back run, and see it synced; password reset revokes the token", async ({
    playwright,
    baseURL,
  }) => {
    const api = await playwright.request.newContext({ baseURL });

    expect((await api.post("/api/auth/register", { data: { email, password } })).status()).toBe(201);

    const badLogin = await api.post("/api/mobile/auth/login", { data: { email, password: "wrongpassword1" } });
    expect(badLogin.status()).toBe(401);

    const login = await api.post("/api/mobile/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };

    expect((await api.get("/api/mobile/me")).status()).toBe(401);
    expect((await api.get("/api/mobile/me", { headers: { Authorization: "Bearer not.a.token" } })).status()).toBe(401);

    // A fresh signup hasn't onboarded: the app must send them to the web
    // rather than invent a starting level.
    const before = await (await api.get("/api/mobile/me", { headers: auth })).json();
    expect(before.onboarded).toBe(false);
    expect(before.nBack).toBeNull();

    // Stand in for onboarding's calibration result (covered end-to-end
    // by onboarding.spec.ts) with a real DifficultyState row.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const definition = await prisma.taskDefinition.findUniqueOrThrow({
      where: { method: "adaptive-nback-v0" },
      include: { versions: { orderBy: { releasedAt: "desc" }, take: 1 } },
    });
    await prisma.difficultyState.create({
      data: { userId: user.id, taskVersionId: definition.versions[0].id, currentDifficulty: 3 },
    });

    const onboarded = await (await api.get("/api/mobile/me", { headers: auth })).json();
    expect(onboarded.onboarded).toBe(true);
    expect(onboarded.nBack).toEqual({ currentDifficulty: 3, scoredTrials: 0 });

    const start = await api.post("/api/training-sessions", { headers: auth });
    expect(start.status()).toBe(201);
    const { id } = await start.json();

    const now = Date.now();
    const exercise = await api.post(`/api/training-sessions/${id}/exercises`, {
      headers: auth,
      data: {
        method: "adaptive-nback-v0",
        startDifficulty: 3,
        endDifficulty: 4,
        trials: [
          {
            correct: true,
            reactionTimeMs: 612,
            stimulusStartedAtMs: now,
            respondedAtMs: now + 612,
            wasInterrupted: false,
            difficultyAtTrial: 3,
            metadata: { client: "mobile-app", platform: "android" },
          },
          {
            correct: false,
            stimulusStartedAtMs: now + 3150,
            wasInterrupted: true,
            difficultyAtTrial: 3,
            metadata: { client: "mobile-app", platform: "android", interrupted: true },
          },
        ],
      },
    });
    expect(exercise.status()).toBe(200);

    const complete = await api.post(`/api/training-sessions/${id}/complete`, {
      headers: auth,
      data: { totalDurationSeconds: 64 },
    });
    expect(complete.status()).toBe(200);

    const after = await (await api.get("/api/mobile/me", { headers: auth })).json();
    expect(after.nBack).toEqual({ currentDifficulty: 4, scoredTrials: 1 });
    expect(after.streak).toMatchObject({ currentStreakDays: 1, trainedToday: true });
    expect(after.trainingLevel.totalXp).toBeGreaterThan(0);

    const stored = await prisma.trial.findMany({ where: { trainingSessionId: id } });
    expect(stored).toHaveLength(2);
    expect(stored.find((t) => t.wasInterrupted)?.correct).toBe(false);

    // Someone else's session id is not writable with this token.
    const otherSession = await prisma.trainingSession.create({
      data: { user: { create: { email: `e2e-mobile-api-other-${Date.now()}@example.com` } } },
    });
    try {
      const foreign = await api.post(`/api/training-sessions/${otherSession.id}/complete`, {
        headers: auth,
        data: { totalDurationSeconds: 1 },
      });
      expect(foreign.status()).toBe(404);
    } finally {
      await prisma.user.delete({ where: { id: otherSession.userId } });
    }

    // Password reset on the web revokes the app's token; signing in again with the new password works at once.
    await new Promise((r) => setTimeout(r, 1100));
    const rawToken = await createPasswordResetToken(email);
    expect((await api.post("/api/auth/reset-password", { data: { email, token: rawToken, password: newPassword } })).status()).toBe(200);
    expect((await api.get("/api/mobile/me", { headers: auth })).status()).toBe(401);

    const relogin = await api.post("/api/mobile/auth/login", { data: { email, password: newPassword } });
    expect(relogin.status()).toBe(200);
    const fresh = { Authorization: `Bearer ${(await relogin.json()).token}` };
    expect((await api.get("/api/mobile/me", { headers: fresh })).status()).toBe(200);

    await api.dispose();
  });
});

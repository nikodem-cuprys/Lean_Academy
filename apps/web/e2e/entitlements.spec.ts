import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { getProgressData } from "../src/lib/progress-data";

// Verifies docs/kanban.md's "Entitlement system + honest free/premium
// split" card: apps/web/src/lib/entitlements.ts's isPremiumUser reads
// the real (previously unused) Subscription model — every user is FREE
// by default, since nothing has ever written a Subscription row before
// this card and the schema's own `plan` default is FREE. No Stripe
// integration exists yet to reach PREMIUM through the UI, so tests grant
// it directly via Prisma — the same "direct write for a state an
// external dependency this suite doesn't manage would otherwise gate"
// pattern already used elsewhere (e.g. personal-bests.spec.ts).

async function grantPremium(userId: string) {
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
    update: { plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
  });
}

test.describe("Entitlements — near-transfer assessment gate", () => {
  const email = `e2e-entitlements-assessment-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
      await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
      await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
      await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("a free account is blocked from the assessment page and the API; a premium account is let through", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // Onboarding (via the real completion API, not the full UI flow —
    // same shortcut e2e/achievements.spec.ts/weekly-challenges.spec.ts
    // already take) is the minimum needed to reach Progress's tab bar,
    // which stays hidden behind the "Nothing trained yet" empty state
    // for a genuinely untouched account — unrelated to entitlements, but
    // required to reach the CTA this test checks.
    const onboardingRes = await page.request.post("/api/onboarding/complete", {
      data: {
        goal: "balanced",
        dailyMinutes: 10,
        experienceLevel: "some",
        difficultyLevel: "AUTO",
        calibration: [
          { method: "adaptive-nback-v0", correct: 6, total: 8 },
          { method: "visuospatial-sequence-recall-v0", correct: 3, total: 4 },
          { method: "complex-span-v0", correct: 4, total: 5 },
          { method: "reading-paced-adaptive-v0", correct: 1, total: 1 },
        ],
      },
    });
    expect(onboardingRes.ok()).toBe(true);

    // Free (the default): the page shows the honest gate, not the real
    // assessment, and the CTA on Progress's Similar tasks tab is locked.
    await page.goto("/assessments/backward-digit-span");
    await expect(page.getByTestId("premium-required")).toBeVisible();
    await expect(page.getByTestId("start-assessment")).toHaveCount(0);

    await page.goto("/progress");
    await page.getByTestId("progress-tab-similar").click();
    await expect(page.getByRole("link", { name: "🔒 Backward Digit Span (Premium)" })).toBeVisible();
    await expect(page.getByTestId("near-transfer-premium-note")).toBeVisible();

    // Server-side defense in depth — a free account's direct POST must
    // be rejected too, not just hidden from the page.
    const blockedPost = await page.request.post("/api/assessments/backward-digit-span", {
      data: { finalSpan: 3, totalCorrect: 3, totalTrials: 3, finalSpanCorrect: 1, finalSpanTrials: 1 },
    });
    expect(blockedPost.status()).toBe(403);

    // Grant a real premium subscription and confirm the gate actually
    // opens — proving this reads live entitlement state, not a cached
    // decision from sign-up.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await grantPremium(user.id);

    await page.goto("/assessments/backward-digit-span");
    await expect(page.getByTestId("premium-required")).toHaveCount(0);
    await expect(page.getByTestId("start-assessment")).toBeVisible();

    await page.goto("/progress");
    await page.getByTestId("progress-tab-similar").click();
    await expect(page.getByRole("link", { name: "Take the Backward Digit Span assessment" })).toBeVisible();
  });
});

test.describe("Entitlements — free-tier 30-day trained-task history cap", () => {
  const email = `e2e-entitlements-history-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
      await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("a free account's trained-task trend only reflects the last 30 days; premium sees the full real history", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // One real session 60 real days ago, one real session now — both
    // through the actual production route, just with a controlled
    // stimulusStartedAtMs so the "old" one falls outside the free-tier
    // window without needing to wait 60 real days.
    const oldSession = await (await page.request.post("/api/training-sessions")).json();
    await page.request.post(`/api/training-sessions/${oldSession.id}/exercises`, {
      data: {
        method: "adaptive-nback-v0",
        startDifficulty: 2,
        endDifficulty: 2,
        trials: [
          { correct: true, stimulusStartedAtMs: Date.now() - SIXTY_DAYS_MS, wasInterrupted: false, difficultyAtTrial: 2 },
        ],
      },
    });
    const newSession = await (await page.request.post("/api/training-sessions")).json();
    await page.request.post(`/api/training-sessions/${newSession.id}/exercises`, {
      data: {
        method: "adaptive-nback-v0",
        startDifficulty: 2,
        endDifficulty: 3,
        trials: [{ correct: true, stimulusStartedAtMs: Date.now(), wasInterrupted: false, difficultyAtTrial: 3 }],
      },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const freeData = await getProgressData(user.id);
    const freeTask = freeData.trainedTasks.find((t) => t.method === "adaptive-nback-v0");
    expect(freeTask?.historyLimitedToLast30Days).toBe(true);
    expect(freeTask?.progressLabel).toContain("over 1 session");

    // The real page, still on the free plan, shows the honest note
    // explaining that older history exists but isn't shown.
    await page.goto("/progress");
    await expect(page.getByTestId("history-limited-adaptive-nback-v0")).toBeVisible();

    await grantPremium(user.id);
    const premiumData = await getProgressData(user.id);
    const premiumTask = premiumData.trainedTasks.find((t) => t.method === "adaptive-nback-v0");
    expect(premiumTask?.historyLimitedToLast30Days).toBe(false);
    expect(premiumTask?.progressLabel).toContain("over 2 sessions");
  });
});

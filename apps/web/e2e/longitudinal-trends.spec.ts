import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Verifies docs/kanban.md's "Longitudinal trend view" card. No Stripe
// integration exists to reach PREMIUM through the UI, so premium is
// granted directly via Prisma — the same pattern entitlements.spec.ts
// already established. Real sessions are posted through the actual
// production routes (POST /api/training-sessions +
// .../[id]/exercises), just with a controlled stimulusStartedAtMs, so
// dozens of real calendar days of history don't have to be waited out —
// the same technique entitlements.spec.ts's 30-day-cap test already uses.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const password = "correcthorsebattery123";

async function grantPremium(userId: string) {
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
    update: { plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
  });
}

async function postNBackSession(page: import("@playwright/test").Page, daysAgo: number, difficulty: number) {
  const session = await (await page.request.post("/api/training-sessions")).json();
  await page.request.post(`/api/training-sessions/${session.id}/exercises`, {
    data: {
      method: "adaptive-nback-v0",
      startDifficulty: difficulty,
      endDifficulty: difficulty,
      trials: [
        {
          correct: true,
          stimulusStartedAtMs: Date.now() - daysAgo * ONE_DAY_MS,
          wasInterrupted: false,
          difficultyAtTrial: difficulty,
        },
      ],
    },
  });
}

async function postReadingSession(page: import("@playwright/test").Page, daysAgo: number, wpm: number, correct: boolean) {
  const session = await (await page.request.post("/api/training-sessions")).json();
  await page.request.post(`/api/training-sessions/${session.id}/exercises`, {
    data: {
      method: "reading-paced-adaptive-v0",
      startDifficulty: 1,
      endDifficulty: 1,
      trials: [
        {
          correct,
          stimulusStartedAtMs: Date.now() - daysAgo * ONE_DAY_MS,
          wasInterrupted: false,
          difficultyAtTrial: 1,
          metadata: { actualWpm: wpm, passageId: "p1" },
        },
      ],
    },
  });
}

test.describe("Longitudinal trend view", () => {
  const email = `e2e-trends-${Date.now()}@example.com`;

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
      await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
      await prisma.subscription.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("free account is gated; premium sees an honest 'not enough data' state, then a real chart once there's enough", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // Free: the honest premium gate, not the real feature.
    await page.goto("/progress/trends");
    await expect(page.getByTestId("premium-required")).toBeVisible();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await grantPremium(user.id);

    // Only 2 real N-Back sessions, both today — real data, but neither
    // enough sessions (needs 5) nor enough real calendar span (needs 14
    // days) for a trend that wouldn't be misleading.
    await postNBackSession(page, 1, 2);
    await postNBackSession(page, 0, 2);

    await page.goto("/progress/trends");
    await expect(page.getByTestId("premium-required")).toHaveCount(0);
    await expect(page.getByTestId("trend-not-enough-data-adaptive-nback-v0")).toBeVisible();
    await expect(page.getByTestId("trend-adaptive-nback-v0")).toHaveCount(0);

    // 4 more N-Back sessions, spread back to 16 real days ago — 6 total
    // sessions spanning 16 real days, clearing both thresholds.
    await postNBackSession(page, 16, 2);
    await postNBackSession(page, 12, 3);
    await postNBackSession(page, 8, 3);
    await postNBackSession(page, 4, 4);

    await page.goto("/progress/trends");
    await expect(page.getByTestId("trend-not-enough-data-adaptive-nback-v0")).toHaveCount(0);
    const chart = page.getByTestId("trend-adaptive-nback-v0");
    await expect(chart).toBeVisible();

    // Real underlying values, checked via the table view (deterministic;
    // avoids asserting on SVG pixel geometry) rather than assumed from
    // the chart rendering.
    await page.getByTestId("trend-adaptive-nback-v0-table-toggle").click();
    const rows = page.getByTestId("trend-adaptive-nback-v0-table").locator("tbody tr");
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toContainText("Level 2");
    await expect(rows.nth(5)).toContainText("Level 2");

    // Reading gets its own real, paired WPM + comprehension trend —
    // never one without the other, per the project's content rule.
    await postReadingSession(page, 16, 220, true);
    await postReadingSession(page, 12, 240, true);
    await postReadingSession(page, 8, 250, false);
    await postReadingSession(page, 4, 260, true);
    await postReadingSession(page, 0, 280, true);

    await page.goto("/progress/trends");
    await expect(page.getByTestId("trend-not-enough-data-reading")).toHaveCount(0);
    await expect(page.getByTestId("trend-reading-wpm")).toBeVisible();
    await expect(page.getByTestId("trend-reading-comprehension")).toBeVisible();

    await page.getByTestId("trend-reading-wpm-table-toggle").click();
    const wpmRows = page.getByTestId("trend-reading-wpm-table").locator("tbody tr");
    await expect(wpmRows).toHaveCount(5);
    await expect(wpmRows.first()).toContainText("220 WPM");
    await expect(wpmRows.last()).toContainText("280 WPM");

    await page.getByTestId("trend-reading-comprehension-table-toggle").click();
    const comprehensionRows = page.getByTestId("trend-reading-comprehension-table").locator("tbody tr");
    await expect(comprehensionRows.nth(2)).toContainText("0%");
  });
});

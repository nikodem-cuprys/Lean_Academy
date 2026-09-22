import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import {
  syncDailyQuestProgress,
  getDailyQuestsStatus,
  DAILY_SESSION_COUNT_TARGET,
  DAILY_XP_TARGET,
  DAILY_ACCURACY_FLOOR,
} from "../src/lib/daily-quests";

// Verifies the Daily Quests card (see docs/kanban.md's Gamification
// epic) end to end — same split as weekly-challenges.spec.ts: a real
// browser test confirming an actual production trigger (a completed
// training session) writes real ChallengeProgress rows visible on
// /challenges, plus direct calls to the same production
// syncDailyQuestProgress function against real Postgres for the
// accuracy-floor and XP quests, which would otherwise need a real
// session scored a specific way to reach through the UI.
//
// Challenge rows themselves are real but shared/global for the current
// UTC day (see daily-quests.ts) — tests never delete them, only each
// test's own ChallengeProgress/TrainingSession/Trial/XpEntry/User rows.

test.describe("Daily Quests — real browser trigger", () => {
  const email = `e2e-daily-quests-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.challengeProgress.deleteMany({ where: { userId: user.id } });
      await prisma.xpEntry.deleteMany({ where: { userId: user.id } });
      await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("a completed session advances the real daily session-count quest and shows on /challenges", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/challenges");
    await expect(page.getByText("Daily Quests")).toBeVisible();
    await expect(page.getByTestId("challenge-daily-complete-session")).toContainText(`0 of ${DAILY_SESSION_COUNT_TARGET}`);

    const createRes = await page.request.post("/api/training-sessions");
    const { id } = await createRes.json();
    const completeRes = await page.request.post(`/api/training-sessions/${id}/complete`, {
      data: { totalDurationSeconds: 60 },
    });
    expect(completeRes.ok()).toBe(true);

    await page.goto("/challenges");
    await expect(page.getByTestId("challenge-daily-complete-session")).toContainText("Complete");
  });
});

test.describe("Daily Quests — accuracy floor and XP target (direct, real-DB)", () => {
  const userId = `e2e-daily-quests-direct-${Date.now()}`;
  let nbackTaskVersionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Daily Quests Direct" } });
    const nback = await prisma.taskDefinition.findUnique({ where: { method: "adaptive-nback-v0" }, include: { versions: true } });
    nbackTaskVersionId = nback!.versions[0].id;
  });

  test.afterAll(async () => {
    await prisma.challengeProgress.deleteMany({ where: { userId } });
    await prisma.xpEntry.deleteMany({ where: { userId } });
    await prisma.trial.deleteMany({ where: { trainingSession: { userId } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("a session genuinely below the accuracy floor does not complete the accuracy quest; a later session at/above it does", async () => {
    const belowFloor = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // 1 of 2 correct = 50%, genuinely below DAILY_ACCURACY_FLOOR.
    await prisma.trial.create({ data: { trainingSessionId: belowFloor.id, taskVersionId: nbackTaskVersionId, difficultyAtTrial: 1, correct: true, stimulusStartedAt: new Date() } });
    await prisma.trial.create({ data: { trainingSessionId: belowFloor.id, taskVersionId: nbackTaskVersionId, difficultyAtTrial: 1, correct: false, stimulusStartedAt: new Date() } });

    await syncDailyQuestProgress(userId);
    let status = await getDailyQuestsStatus(userId);
    expect(status.find((q) => q.slug === "daily-accuracy")).toMatchObject({ progressCurrent: 0, completed: false });

    const atFloor = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // 9 of 10 correct = 90%, genuinely at/above DAILY_ACCURACY_FLOOR (0.85).
    for (let i = 0; i < 10; i++) {
      await prisma.trial.create({
        data: { trainingSessionId: atFloor.id, taskVersionId: nbackTaskVersionId, difficultyAtTrial: 1, correct: i < 9, stimulusStartedAt: new Date() },
      });
    }

    await syncDailyQuestProgress(userId);
    status = await getDailyQuestsStatus(userId);
    expect(status.find((q) => q.slug === "daily-accuracy")).toMatchObject({ completed: true });
    expect(DAILY_ACCURACY_FLOOR).toBeLessThanOrEqual(0.9);
  });

  test(`a real XpEntry total reaching ${DAILY_XP_TARGET} XP today completes the XP quest`, async () => {
    const partialAmount = Math.max(1, DAILY_XP_TARGET - 5);
    await prisma.xpEntry.create({ data: { userId, amount: partialAmount, reason: "SESSION_COMPLETION", createdAt: new Date() } });
    await syncDailyQuestProgress(userId);
    let status = await getDailyQuestsStatus(userId);
    expect(status.find((q) => q.slug === "daily-earn-xp")).toMatchObject({ progressCurrent: partialAmount, completed: false });

    await prisma.xpEntry.create({ data: { userId, amount: 5, reason: "CONSISTENCY_BONUS", createdAt: new Date() } });
    await syncDailyQuestProgress(userId);
    status = await getDailyQuestsStatus(userId);
    expect(status.find((q) => q.slug === "daily-earn-xp")).toMatchObject({ progressCurrent: DAILY_XP_TARGET, completed: true });
  });
});

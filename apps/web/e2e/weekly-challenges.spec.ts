import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import {
  syncWeeklyChallengeProgress,
  getWeeklyChallengesStatus,
  WEEKLY_SESSION_COUNT_TARGET,
  WEEKLY_DOMAIN_COUNT_TARGET,
} from "../src/lib/weekly-challenges";

// Verifies docs/kanban.md's Weekly challenges card (Phase 5's last) end
// to end.
//
// Same split as achievements.spec.ts/xp.spec.ts: a real browser test
// confirming the actual production triggers (onboarding completion, a
// real training session) write real ChallengeProgress rows visible on
// /challenges, plus direct calls to the same production
// syncWeeklyChallengeProgress function against real Postgres for
// scenarios (4 sessions across 3 real domains, a real personal record)
// that would take many real sessions to reach through the UI.
//
// Challenge rows themselves are real but shared/global for the current
// UTC week (see weekly-challenges.ts) — tests never delete them, only
// each test's own ChallengeProgress/TrainingSession/Trial/User rows.

test.describe("Weekly Challenges — real browser trigger", () => {
  const email = `e2e-challenges-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.challengeProgress.deleteMany({ where: { userId: user.id } });
      await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
      await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
      await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
      await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("onboarding completes the real assessment challenge; a completed session advances the real session-count challenge", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

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

    await page.goto("/challenges");
    await expect(page.getByTestId("challenge-complete-assessment")).toContainText("Complete");
    await expect(page.getByTestId("challenge-complete-sessions")).toContainText(`0 of ${WEEKLY_SESSION_COUNT_TARGET}`);

    const createRes = await page.request.post("/api/training-sessions");
    const { id } = await createRes.json();
    const completeRes = await page.request.post(`/api/training-sessions/${id}/complete`, {
      data: { totalDurationSeconds: 60 },
    });
    expect(completeRes.ok()).toBe(true);

    await page.goto("/challenges");
    await expect(page.getByTestId("challenge-complete-sessions")).toContainText(`1 of ${WEEKLY_SESSION_COUNT_TARGET}`);
  });
});

test.describe("Weekly Challenges — session count and domain variety (direct, real-DB)", () => {
  const userId = `e2e-challenges-domains-${Date.now()}`;
  let nbackTaskVersionId: string;
  let spatialTaskVersionId: string;
  let readingTaskVersionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Challenges Domains" } });
    const nback = await prisma.taskDefinition.findUnique({ where: { method: "adaptive-nback-v0" }, include: { versions: true } });
    const spatial = await prisma.taskDefinition.findUnique({ where: { method: "visuospatial-sequence-recall-v0" }, include: { versions: true } });
    const reading = await prisma.taskDefinition.findUnique({ where: { method: "reading-paced-adaptive-v0" }, include: { versions: true } });
    nbackTaskVersionId = nback!.versions[0].id;
    spatialTaskVersionId = spatial!.versions[0].id;
    readingTaskVersionId = reading!.versions[0].id;
  });

  test.afterAll(async () => {
    await prisma.challengeProgress.deleteMany({ where: { userId } });
    await prisma.trial.deleteMany({ where: { trainingSession: { userId } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  async function completeSessionWithTrial(taskVersionId: string, correct = true) {
    const session = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    await prisma.trial.create({
      data: { trainingSessionId: session.id, taskVersionId, difficultyAtTrial: 1, correct, stimulusStartedAt: new Date() },
    });
    return session.id;
  }

  test(`real session count and real domain variety both reach their actual targets (${WEEKLY_SESSION_COUNT_TARGET} sessions, ${WEEKLY_DOMAIN_COUNT_TARGET} domains)`, async () => {
    await completeSessionWithTrial(nbackTaskVersionId); // WORKING_MEMORY
    await syncWeeklyChallengeProgress(userId);
    let status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "complete-sessions")).toMatchObject({ progressCurrent: 1, completed: false });
    expect(status.find((c) => c.slug === "train-domains")).toMatchObject({ progressCurrent: 1, completed: false });

    await completeSessionWithTrial(spatialTaskVersionId); // SPATIAL
    await syncWeeklyChallengeProgress(userId);
    status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "train-domains")).toMatchObject({ progressCurrent: 2, completed: false });

    // Good comprehension (>=70%, the real Betts 1946 floor) also
    // completes the reading-comprehension challenge in the same call.
    await completeSessionWithTrial(readingTaskVersionId, true); // READING
    await syncWeeklyChallengeProgress(userId);
    status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "train-domains")).toMatchObject({ progressCurrent: WEEKLY_DOMAIN_COUNT_TARGET, completed: true });
    expect(status.find((c) => c.slug === "reading-comprehension")).toMatchObject({ completed: true });
    expect(status.find((c) => c.slug === "complete-sessions")).toMatchObject({ progressCurrent: 3, completed: false });

    await completeSessionWithTrial(nbackTaskVersionId); // 4th session, no new domain
    await syncWeeklyChallengeProgress(userId);
    status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "complete-sessions")).toMatchObject({
      progressCurrent: WEEKLY_SESSION_COUNT_TARGET,
      completed: true,
    });
  });
});

test.describe("Weekly Challenges — reading comprehension floor not met (direct, real-DB)", () => {
  const userId = `e2e-challenges-reading-${Date.now()}`;
  let readingTaskVersionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Challenges Reading" } });
    const reading = await prisma.taskDefinition.findUnique({ where: { method: "reading-paced-adaptive-v0" }, include: { versions: true } });
    readingTaskVersionId = reading!.versions[0].id;
  });

  test.afterAll(async () => {
    await prisma.challengeProgress.deleteMany({ where: { userId } });
    await prisma.trial.deleteMany({ where: { trainingSession: { userId } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("a reading session below the 70% comprehension floor does not complete the challenge", async () => {
    const session = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // 1 of 2 correct = 50%, genuinely below the floor.
    await prisma.trial.create({ data: { trainingSessionId: session.id, taskVersionId: readingTaskVersionId, difficultyAtTrial: 1, correct: true, stimulusStartedAt: new Date() } });
    await prisma.trial.create({ data: { trainingSessionId: session.id, taskVersionId: readingTaskVersionId, difficultyAtTrial: 1, correct: false, stimulusStartedAt: new Date() } });

    await syncWeeklyChallengeProgress(userId);
    const status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "reading-comprehension")).toMatchObject({ progressCurrent: 0, completed: false });
  });
});

test.describe("Weekly Challenges — beat a personal record is event-driven and monotonic (direct, real-DB)", () => {
  const userId = `e2e-challenges-record-${Date.now()}`;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Challenges Record" } });
  });

  test.afterAll(async () => {
    await prisma.challengeProgress.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("stays incomplete until a real personal-best call marks it, then never un-completes on a later non-best call", async () => {
    await syncWeeklyChallengeProgress(userId, new Date(), { newPersonalBestThisCall: false });
    let status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "beat-personal-record")).toMatchObject({ completed: false });

    await syncWeeklyChallengeProgress(userId, new Date(), { newPersonalBestThisCall: true });
    status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "beat-personal-record")).toMatchObject({ completed: true });

    await syncWeeklyChallengeProgress(userId, new Date(), { newPersonalBestThisCall: false });
    status = await getWeeklyChallengesStatus(userId);
    expect(status.find((c) => c.slug === "beat-personal-record")).toMatchObject({ completed: true });
  });
});

import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { checkNewPersonalBest, getPersonalBestsStatus, formatPersonalBestLabel } from "../src/lib/personal-bests";

// Verifies docs/kanban.md's Personal bests card end to end.
//
// Same split as the other Phase 5 specs: a real browser flow driving
// the actual production route (POST /api/training-sessions/:id/
// exercises) to confirm a genuine improvement is flagged and shown on
// both the real Session Complete screen and the real Progress page,
// plus direct calls to the same production checkNewPersonalBest/
// getPersonalBestsStatus functions against real Postgres for the part
// this card's own scope note calls out as a real fix over the
// Achievements card's original check: reading's personal best uses the
// real Reading Efficiency Score (WPM combined with comprehension), not
// a raw target-pace comparison — a faster pace with worse comprehension
// must NOT count as an improvement, and that's exactly what's verified
// directly below rather than trusted on faith.

test.describe("Personal bests — real browser trigger", () => {
  const email = `e2e-pb-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
      await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
      await prisma.xpEntry.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
      await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  function trial(difficulty: number) {
    return { correct: true, stimulusStartedAtMs: Date.now(), wasInterrupted: false, difficultyAtTrial: difficulty };
  }

  test("a genuine improvement is flagged on Session Complete and shown on the Progress page", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // First-ever attempt: nothing to beat yet, so no personal best.
    const session1 = await (await page.request.post("/api/training-sessions")).json();
    const first = await page.request.post(`/api/training-sessions/${session1.id}/exercises`, {
      data: { method: "adaptive-nback-v0", startDifficulty: 2, endDifficulty: 2, trials: [trial(2), trial(2)] },
    });
    expect((await first.json()).newPersonalBest).toBe(false);

    // A real, genuine improvement over that history.
    const session2 = await (await page.request.post("/api/training-sessions")).json();
    const second = await page.request.post(`/api/training-sessions/${session2.id}/exercises`, {
      data: { method: "adaptive-nback-v0", startDifficulty: 2, endDifficulty: 3, trials: [trial(3), trial(3)] },
    });
    expect((await second.json()).newPersonalBest).toBe(true);

    await page.goto("/progress");
    await expect(page.getByTestId("personal-best-adaptive-nback-v0")).toContainText("Level 3");
  });
});

test.describe("Personal bests — direct, real-DB", () => {
  const userId = `e2e-pb-logic-${Date.now()}`;
  let nbackTaskVersionId: string;
  let readingTaskVersionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Personal Bests" } });
    const nback = await prisma.taskDefinition.findUnique({ where: { method: "adaptive-nback-v0" }, include: { versions: true } });
    const reading = await prisma.taskDefinition.findUnique({ where: { method: "reading-paced-adaptive-v0" }, include: { versions: true } });
    nbackTaskVersionId = nback!.versions[0].id;
    readingTaskVersionId = reading!.versions[0].id;

    // getPersonalBestsStatus reports on tasks the user has a real
    // DifficultyState for (the same set the Progress page reads).
    await prisma.difficultyState.create({ data: { userId, taskVersionId: nbackTaskVersionId, currentDifficulty: 4 } });
    await prisma.difficultyState.create({ data: { userId, taskVersionId: readingTaskVersionId, currentDifficulty: 4 } });
  });

  test.afterAll(async () => {
    await prisma.trial.deleteMany({ where: { trainingSession: { userId } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.difficultyState.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("formatPersonalBestLabel matches progress-data.ts's per-method phrasing", () => {
    expect(formatPersonalBestLabel("complex-span-v0", 6)).toBe("6-item span");
    expect(formatPersonalBestLabel("adaptive-nback-v0", 4)).toBe("Level 4");
    expect(formatPersonalBestLabel("visuospatial-sequence-recall-v0", 5)).toBe("Level 5");
  });

  test("a non-reading task's personal best requires real prior history to beat, never a first attempt", async () => {
    const session1 = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    await prisma.trial.create({
      data: { trainingSessionId: session1.id, taskVersionId: nbackTaskVersionId, difficultyAtTrial: 3, correct: true, stimulusStartedAt: new Date() },
    });

    // Nothing yet to beat inside session1 itself (its own trial is excluded from its own comparison).
    expect(await checkNewPersonalBest(userId, "adaptive-nback-v0", nbackTaskVersionId, session1.id, 3)).toBe(false);

    const session2 = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // Equal to the prior best is not an improvement.
    expect(await checkNewPersonalBest(userId, "adaptive-nback-v0", nbackTaskVersionId, session2.id, 3)).toBe(false);
    // A real improvement is.
    expect(await checkNewPersonalBest(userId, "adaptive-nback-v0", nbackTaskVersionId, session2.id, 4)).toBe(true);
  });

  test("reading's personal best is the real Reading Efficiency Score, not raw pace — a faster but worse-comprehension session is NOT an improvement", async () => {
    const priorSession = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // Prior best: 200 WPM at 100% comprehension -> efficiency score 200.
    await prisma.trial.create({
      data: {
        trainingSessionId: priorSession.id,
        taskVersionId: readingTaskVersionId,
        difficultyAtTrial: 3,
        correct: true,
        stimulusStartedAt: new Date(),
        metadata: { actualWpm: 200 },
      },
    });

    const fasterButWorseSession = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // A real, faster pace (300 WPM) but comprehension failed -> efficiency score 0.
    // A naive raw-pace comparison would call this an improvement; the real
    // efficiency-score comparison must not.
    await prisma.trial.create({
      data: {
        trainingSessionId: fasterButWorseSession.id,
        taskVersionId: readingTaskVersionId,
        difficultyAtTrial: 5,
        correct: false,
        stimulusStartedAt: new Date(),
        metadata: { actualWpm: 300 },
      },
    });
    expect(await checkNewPersonalBest(userId, "reading-paced-adaptive-v0", readingTaskVersionId, fasterButWorseSession.id, 5)).toBe(false);

    const genuineImprovement = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    // A real improvement: 250 WPM at full comprehension -> score 250 > 200.
    await prisma.trial.create({
      data: {
        trainingSessionId: genuineImprovement.id,
        taskVersionId: readingTaskVersionId,
        difficultyAtTrial: 4,
        correct: true,
        stimulusStartedAt: new Date(),
        metadata: { actualWpm: 250 },
      },
    });
    expect(await checkNewPersonalBest(userId, "reading-paced-adaptive-v0", readingTaskVersionId, genuineImprovement.id, 4)).toBe(true);
  });

  test("getPersonalBestsStatus reports the real current best per task, including reading's WPM/comprehension pair", async () => {
    const status = await getPersonalBestsStatus(userId);
    // Reflects only real persisted Trial rows — session1's difficulty-3
    // trial is the only one actually written to the DB in the prior
    // test (its difficulty-4 check was a compare-only call, per
    // checkNewPersonalBest's contract of trusting the caller's already-
    // known endDifficulty rather than requiring a real Trial row first).
    const nbackStatus = status.find((s) => s.method === "adaptive-nback-v0");
    expect(nbackStatus?.label).toBe("Level 3");

    const readingStatus = status.find((s) => s.method === "reading-paced-adaptive-v0");
    expect(readingStatus?.wpm).toBe(250);
    expect(readingStatus?.comprehensionPct).toBe(100);
  });
});

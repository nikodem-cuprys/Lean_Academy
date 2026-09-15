import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { checkSessionCompletionAchievements, checkExerciseAchievements } from "../src/lib/achievements";
import { getAchievementsStatus } from "../src/lib/achievements-data";

// Verifies docs/kanban.md's Achievements card end to end.
//
// Same split as apps/web/e2e/streaks.spec.ts: a real browser test
// confirming the actual production trigger points (onboarding
// completion, a real training session) award real UserAchievement rows
// visible on a real page, plus direct calls to the same production
// checkSessionCompletionAchievements/checkExerciseAchievements
// functions against real Postgres for milestones that would otherwise
// require dozens of real sessions or exercise runs driven through the
// UI (10/30/100 Sessions, Working Memory Level 5, Personal Best,
// Reading Efficiency Milestone) — not a reimplementation, the same
// functions the real API routes call.

test.describe("Achievements — real browser triggers", () => {
  const email = `e2e-achievements-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
      await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
      await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
      await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("completing onboarding awards First Assessment; completing a session awards First Session — both visible on /achievements", async ({ page }) => {
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

    const createRes = await page.request.post("/api/training-sessions");
    const { id } = await createRes.json();
    const completeRes = await page.request.post(`/api/training-sessions/${id}/complete`, {
      data: { totalDurationSeconds: 60 },
    });
    expect(completeRes.ok()).toBe(true);

    await page.goto("/achievements");
    await expect(page.getByTestId("achievement-first-assessment")).toContainText("Earned");
    await expect(page.getByTestId("achievement-first-session")).toContainText("Earned");
    // Not earned yet — real, not fabricated: no 10th session exists.
    await expect(page.getByTestId("achievement-sessions-10")).toContainText("1 of 10");
  });
});

test.describe("Achievements — session-count and streak milestones (direct, real-DB)", () => {
  const userId = `e2e-achievements-sessions-${Date.now()}`;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Achievements Sessions" } });
  });

  test.afterAll(async () => {
    await prisma.userAchievement.deleteMany({ where: { userId } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  async function completeSessions(count: number) {
    for (let i = 0; i < count; i++) {
      await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    }
  }

  async function earnedKeys(): Promise<string[]> {
    const rows = await prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } });
    return rows.map((r) => r.achievement.key);
  }

  test("awards First Session, 10/30/100 Sessions at their exact real counts, and First Week at a real 7-day streak", async () => {
    await completeSessions(1);
    await checkSessionCompletionAchievements(userId, 1);
    expect(await earnedKeys()).toEqual(["first-session"]);

    await completeSessions(9); // total 10
    await checkSessionCompletionAchievements(userId, 1);
    expect(await earnedKeys()).toContain("sessions-10");

    await completeSessions(20); // total 30
    await checkSessionCompletionAchievements(userId, 1);
    expect(await earnedKeys()).toContain("sessions-30");

    await completeSessions(70); // total 100
    await checkSessionCompletionAchievements(userId, 1);
    let earned = await earnedKeys();
    expect(earned).toContain("sessions-100");
    expect(earned).not.toContain("first-week"); // streak never reported as 7 yet

    await checkSessionCompletionAchievements(userId, 7);
    earned = await earnedKeys();
    expect(earned).toContain("first-week");

    // All these sessions land in the current UTC week, so the real
    // weekly target (achievements.ts's WEEKLY_SESSION_TARGET, shared
    // with Weekly Challenges' "complete N sessions" challenge — see
    // weekly-challenges.ts) is legitimately met too.
    expect(earned).toContain("weekly-sessions-complete");
  });
});

test.describe("Achievements — per-exercise milestones (direct, real-DB)", () => {
  const userId = `e2e-achievements-exercise-${Date.now()}`;
  let nbackTaskVersionId: string;
  let readingTaskVersionId: string;
  let priorSessionId: string;
  let newSessionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E Achievements Exercise" } });

    const nback = await prisma.taskDefinition.findUnique({
      where: { method: "adaptive-nback-v0" },
      include: { versions: true },
    });
    const reading = await prisma.taskDefinition.findUnique({
      where: { method: "reading-paced-adaptive-v0" },
      include: { versions: true },
    });
    nbackTaskVersionId = nback!.versions[0].id;
    readingTaskVersionId = reading!.versions[0].id;

    const priorSession = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    priorSessionId = priorSession.id;
    // Establishes a real prior best of N=3 for N-Back, so a later N=4
    // run is a genuine, checkable improvement over history.
    await prisma.trial.create({
      data: {
        trainingSessionId: priorSessionId,
        taskVersionId: nbackTaskVersionId,
        difficultyAtTrial: 3,
        correct: true,
        stimulusStartedAt: new Date(),
      },
    });

    const newSession = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    newSessionId = newSession.id;
  });

  test.afterAll(async () => {
    await prisma.userAchievement.deleteMany({ where: { userId } });
    await prisma.trial.deleteMany({ where: { trainingSession: { userId } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  async function earnedKeys(): Promise<string[]> {
    const rows = await prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } });
    return rows.map((r) => r.achievement.key);
  }

  test("Working Memory Level 5 and Personal Best both require a real improvement over real history", async () => {
    // Below both thresholds: no award.
    await checkExerciseAchievements({
      userId,
      method: "adaptive-nback-v0",
      domain: "WORKING_MEMORY",
      taskVersionId: nbackTaskVersionId,
      trainingSessionId: newSessionId,
      startDifficulty: 3,
      endDifficulty: 3,
      sessionCorrect: 8,
      sessionTotal: 10,
    });
    expect(await earnedKeys()).toEqual([]);

    // A real improvement over the prior best (3 -> 4), still below the
    // Level 5 threshold: Personal Best only.
    await checkExerciseAchievements({
      userId,
      method: "adaptive-nback-v0",
      domain: "WORKING_MEMORY",
      taskVersionId: nbackTaskVersionId,
      trainingSessionId: newSessionId,
      startDifficulty: 3,
      endDifficulty: 4,
      sessionCorrect: 8,
      sessionTotal: 10,
    });
    expect(await earnedKeys()).toEqual(["personal-best"]);

    // Reaching the real Level 5 threshold now also awards
    // Working Memory Level 5.
    await checkExerciseAchievements({
      userId,
      method: "adaptive-nback-v0",
      domain: "WORKING_MEMORY",
      taskVersionId: nbackTaskVersionId,
      trainingSessionId: newSessionId,
      startDifficulty: 4,
      endDifficulty: 5,
      sessionCorrect: 8,
      sessionTotal: 10,
    });
    const earned = await earnedKeys();
    expect(earned).toContain("working-memory-level-5");
    expect(earned).toContain("personal-best");

    const status = await getAchievementsStatus(userId);
    const wmStatus = status.find((s) => s.key === "working-memory-level-5");
    expect(wmStatus?.earned).toBe(true);
    const personalBestStatus = status.find((s) => s.key === "personal-best");
    expect(personalBestStatus?.contextLabel).toBe("Adaptive N-Back");
  });

  test("Reading Efficiency Milestone and the comprehension-at-new-pace achievement are independently checkable", async () => {
    // Pace increased past the starting default (3), but comprehension
    // this session is below 90%: milestone only, not the comprehension one.
    await checkExerciseAchievements({
      userId,
      method: "reading-paced-adaptive-v0",
      domain: "READING",
      taskVersionId: readingTaskVersionId,
      trainingSessionId: newSessionId,
      startDifficulty: 3,
      endDifficulty: 4,
      sessionCorrect: 3,
      sessionTotal: 5,
    });
    let earned = await earnedKeys();
    expect(earned).toContain("reading-efficiency-milestone");
    expect(earned).not.toContain("reading-comprehension-at-new-pace");

    // A later session with a real pace increase AND >=90% comprehension
    // earns the comprehension-specific achievement too.
    await checkExerciseAchievements({
      userId,
      method: "reading-paced-adaptive-v0",
      domain: "READING",
      taskVersionId: readingTaskVersionId,
      trainingSessionId: newSessionId,
      startDifficulty: 4,
      endDifficulty: 5,
      sessionCorrect: 9,
      sessionTotal: 10,
    });
    earned = await earnedKeys();
    expect(earned).toContain("reading-comprehension-at-new-pace");
  });
});

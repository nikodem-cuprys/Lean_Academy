import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import {
  awardXp,
  recordSessionCompletionXp,
  recordNewDomainXpIfFirstTime,
  consistencyBonusFor,
  levelForXp,
  xpThresholdForLevel,
  XP_AMOUNTS,
  DAILY_XP_CAP,
  getTrainingLevelStatus,
} from "../src/lib/xp";
import { checkFirstAssessmentAchievement } from "../src/lib/achievements";

// Verifies docs/kanban.md's XP + Training Level card end to end.
//
// Same split as streaks.spec.ts/achievements.spec.ts: a real browser
// test confirming the actual production trigger (completing a real
// training session) awards real XpEntry rows and shows on a real page,
// plus direct calls to the same production xp.ts functions against
// real Postgres for the anti-grind cap and level-formula behavior that
// would otherwise need dozens of real sessions in one real day to
// reach through the UI — project_prompt.txt's own explicit requirement
// ("avoid rewarding endless repetitive grinding... cap or reduce XP
// from excessive training") is exactly what the cap test below checks.
//
// Each direct-DB scenario below uses its own dedicated user so tests
// never share mutable XP state with each other.

test.describe("XP + Training Level — real browser trigger", () => {
  const email = `e2e-xp-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.xpEntry.deleteMany({ where: { userId: user.id } });
      await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
      await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("completing a real training session writes real XpEntry rows and the Home page shows the real Training Level", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    const createRes = await page.request.post("/api/training-sessions");
    const { id } = await createRes.json();
    const completeRes = await page.request.post(`/api/training-sessions/${id}/complete`, {
      data: { totalDurationSeconds: 60 },
    });
    const body = await completeRes.json();

    // A brand-new user's very first session also earns the real "First
    // Session" achievement, which (per this card's XP-on-achievement
    // wiring) awards its own 25 XP *before* recordSessionCompletionXp
    // runs — so this function's own totalXpBefore is 25, not 0. Its own
    // contribution is base completion (20) + a 1-day consistency bonus
    // (2) = 22 more XP, landing at a real 47 total, still Level 1.
    expect(body.xp).toEqual({
      awarded: 22,
      totalXpBefore: 25,
      totalXpAfter: 47,
      levelBefore: 1,
      levelAfter: 1,
      leveledUp: false,
    });

    await page.goto("/");
    await expect(page.getByTestId("training-level-indicator")).toHaveText("Training Level 1");

    const user = await prisma.user.findUnique({ where: { email } });
    const entries = await prisma.xpEntry.findMany({ where: { userId: user!.id } });
    expect(entries.map((e) => e.reason).sort()).toEqual(["ACHIEVEMENT_BONUS", "CONSISTENCY_BONUS", "SESSION_COMPLETION"]);
    const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
    expect(totalAmount).toBe(47);
  });
});

test.describe("XP + Training Level — pure formulas (no DB)", () => {
  test("Training Level formula: each level costs 100 more XP than the last, and levelForXp inverts it correctly", () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(300);
    expect(xpThresholdForLevel(4)).toBe(600);
    expect(xpThresholdForLevel(5)).toBe(1000);

    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });

  test("consistency bonus scales with real streak length, capped at a 10-day streak", () => {
    expect(consistencyBonusFor(1)).toBe(2);
    expect(consistencyBonusFor(5)).toBe(10);
    expect(consistencyBonusFor(10)).toBe(20);
    expect(consistencyBonusFor(30)).toBe(20); // capped, not unbounded
  });
});

test.describe("XP + Training Level — anti-grind cap (direct, real-DB)", () => {
  const userId = `e2e-xp-cap-${Date.now()}`;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E XP Cap" } });
  });

  test.afterAll(async () => {
    await prisma.xpEntry.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("real repeated awards in one UTC day never exceed DAILY_XP_CAP, and a capped-out award writes nothing", async () => {
    const day = new Date("2026-02-01T10:00:00.000Z");

    // Repeated large awards on the same real day, as if grinding.
    let result = await awardXp(userId, 60, "SESSION_COMPLETION", undefined, day);
    expect(result.awarded).toBe(60);
    result = await awardXp(userId, 60, "SESSION_COMPLETION", undefined, day);
    expect(result.awarded).toBe(60); // running total 120, still under 150
    result = await awardXp(userId, 60, "SESSION_COMPLETION", undefined, day);
    expect(result.awarded).toBe(30); // clamped: only 30 left before the 150 cap
    result = await awardXp(userId, 60, "SESSION_COMPLETION", undefined, day);
    expect(result.awarded).toBe(0); // cap already reached — no row written

    const todayEntries = await prisma.xpEntry.count({ where: { userId } });
    expect(todayEntries).toBe(3); // the 0-awarded call wrote nothing

    const totalToday = await prisma.xpEntry.aggregate({ where: { userId }, _sum: { amount: true } });
    expect(totalToday._sum.amount).toBe(DAILY_XP_CAP);

    // A real new UTC day resets the cap.
    const nextDay = new Date("2026-02-02T10:00:00.000Z");
    result = await awardXp(userId, 60, "SESSION_COMPLETION", undefined, nextDay);
    expect(result.awarded).toBe(60);
  });
});

test.describe("XP + Training Level — level-up detection (direct, real-DB)", () => {
  const userId = `e2e-xp-levelup-${Date.now()}`;
  let sessionId: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E XP Level Up" } });
    const trainingSession = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    sessionId = trainingSession.id;
    // Seed this user to exactly 90 XP (10 short of the level-2 threshold at 100).
    await prisma.xpEntry.create({ data: { userId, amount: 90, reason: "SESSION_COMPLETION" } });
  });

  test.afterAll(async () => {
    await prisma.xpEntry.deleteMany({ where: { userId } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("recordSessionCompletionXp detects a real level-up when the combined award crosses a threshold", async () => {
    const before = await getTrainingLevelStatus(userId);
    expect(before).toEqual({ totalXp: 90, level: 1, xpIntoLevel: 90, xpForNextLevel: 100 });

    const result = await recordSessionCompletionXp(userId, sessionId, 1);
    // Base (20) + 1-day consistency (2) = 22 more XP -> 90+22=112, crossing the 100 threshold.
    expect(result).toEqual({ awarded: 22, totalXpBefore: 90, totalXpAfter: 112, levelBefore: 1, levelAfter: 2, leveledUp: true });

    const after = await getTrainingLevelStatus(userId);
    expect(after.totalXp).toBe(112);
    expect(after.level).toBe(2);
  });
});

test.describe("XP + Training Level — achievement-milestone bonus (direct, real-DB)", () => {
  const userId = `e2e-xp-achievement-${Date.now()}`;
  const assessmentId = `e2e-xp-assessment-${Date.now()}`;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E XP Achievement" } });
  });

  test.afterAll(async () => {
    await prisma.assessmentResult.deleteMany({ where: { assessmentId } });
    await prisma.assessment.deleteMany({ where: { id: assessmentId } });
    await prisma.userAchievement.deleteMany({ where: { userId } });
    await prisma.xpEntry.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("achievement bonus XP is awarded exactly once per real achievement, not once per check", async () => {
    expect((await getTrainingLevelStatus(userId)).totalXp).toBe(0);

    await checkFirstAssessmentAchievement(userId); // no AssessmentResult rows yet for this user -> no-op
    expect((await getTrainingLevelStatus(userId)).totalXp).toBe(0);

    await prisma.assessment.create({ data: { id: assessmentId, name: "E2E XP Assessment", type: "BASELINE" } });
    await prisma.assessmentResult.create({ data: { assessmentId, userId, scoreSummary: {} } });

    await checkFirstAssessmentAchievement(userId);
    expect((await getTrainingLevelStatus(userId)).totalXp).toBe(XP_AMOUNTS.ACHIEVEMENT_BONUS);

    // Calling it again (as a second real session might) must not double-award.
    await checkFirstAssessmentAchievement(userId);
    expect((await getTrainingLevelStatus(userId)).totalXp).toBe(XP_AMOUNTS.ACHIEVEMENT_BONUS);
  });
});

test.describe("XP + Training Level — new-domain bonus (direct, real-DB)", () => {
  const userId = `e2e-xp-domain-${Date.now()}`;
  let taskVersionId: string;
  let session1Id: string;
  let session2Id: string;

  test.beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.com`, name: "E2E XP Domain" } });
    const nback = await prisma.taskDefinition.findUnique({
      where: { method: "adaptive-nback-v0" },
      include: { versions: true },
    });
    taskVersionId = nback!.versions[0].id;
    const session1 = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    session1Id = session1.id;
    const session2 = await prisma.trainingSession.create({ data: { userId, status: "COMPLETED", completedAt: new Date() } });
    session2Id = session2.id;
  });

  test.afterAll(async () => {
    await prisma.trial.deleteMany({ where: { trainingSessionId: { in: [session1Id, session2Id] } } });
    await prisma.trainingSession.deleteMany({ where: { userId } });
    await prisma.xpEntry.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  test("awards once on a user's first-ever trial for a task, never again for that same task", async () => {
    const first = await recordNewDomainXpIfFirstTime(userId, taskVersionId, session1Id);
    expect(first?.awarded).toBe(XP_AMOUNTS.NEW_DOMAIN_BONUS);

    // Now a real Trial exists for this taskVersion — a second session on
    // the same task must not re-trigger the "new domain" bonus.
    await prisma.trial.create({
      data: { trainingSessionId: session1Id, taskVersionId, difficultyAtTrial: 2, correct: true, stimulusStartedAt: new Date() },
    });
    const second = await recordNewDomainXpIfFirstTime(userId, taskVersionId, session2Id);
    expect(second).toBeNull();
  });
});

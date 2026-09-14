import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { recordActiveDayForStreak, getStreakStatus } from "../src/lib/streak";

// Verifies docs/kanban.md's Streaks card end to end.
//
// Two kinds of check, deliberately split:
// 1. A real browser test confirming the actual production trigger (POST
//    /api/training-sessions/:id/complete) writes a real Streak row and
//    that the Home page renders it — the same class of proof
//    session.spec.ts already establishes for Trial/DifficultyState rows.
// 2. Direct calls to recordActiveDayForStreak/getStreakStatus against
//    the real Postgres database (still the actual production function,
//    not a reimplementation) for the multi-day increment/freeze/reset
//    behavior, since a browser can't fast-forward real calendar days —
//    the `now` parameter exists specifically so this logic is testable
//    without mocking the system clock.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

test.describe("Streaks", () => {
  const email = `e2e-streak-browser-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("completing a real training session writes a Streak row and the Home page shows it", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    const createRes = await page.request.post("/api/training-sessions");
    expect(createRes.ok()).toBe(true);
    const { id } = await createRes.json();

    const completeRes = await page.request.post(`/api/training-sessions/${id}/complete`, {
      data: { totalDurationSeconds: 60 },
    });
    expect(completeRes.ok()).toBe(true);
    const body = await completeRes.json();
    expect(body.streak).toEqual({
      currentStreakDays: 1,
      longestStreakDays: 1,
      streakFreezesAvailable: 1,
      usedFreeze: false,
      streakBroken: false,
    });

    await page.goto("/");
    const indicator = page.getByTestId("streak-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText("🔥1-day streak");
  });
});

test.describe("Streak day-boundary and protection logic (direct, real-DB)", () => {
  const userId = `e2e-streak-logic-${Date.now()}`;
  const base = new Date("2026-01-01T12:00:00.000Z");

  test.beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, name: "E2E Streak Logic" },
    });
  });

  test.afterAll(async () => {
    await prisma.streak.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("increments daily, earns a freeze at 7 days, spends it on exactly one missed day, and resets on two+ missed days", async () => {
    // Day 0: first-ever active day.
    let result = await recordActiveDayForStreak(userId, base);
    expect(result).toEqual({ currentStreakDays: 1, longestStreakDays: 1, streakFreezesAvailable: 1, usedFreeze: false, streakBroken: false });

    // A second completion the same day is a no-op, not a double-count.
    result = await recordActiveDayForStreak(userId, addDays(base, 0));
    expect(result.currentStreakDays).toBe(1);

    // Days 1-6: six more consecutive active days -> current streak reaches 7,
    // which crosses the 7-day freeze-earning threshold (1 -> 2, capped at 2).
    for (let day = 1; day <= 6; day++) {
      result = await recordActiveDayForStreak(userId, addDays(base, day));
    }
    expect(result).toEqual({ currentStreakDays: 7, longestStreakDays: 7, streakFreezesAvailable: 2, usedFreeze: false, streakBroken: false });

    // Day 8: day 7 was skipped (exactly one missed day). A freeze is
    // available, so the streak survives and one freeze is consumed.
    result = await recordActiveDayForStreak(userId, addDays(base, 8));
    expect(result).toEqual({ currentStreakDays: 8, longestStreakDays: 8, streakFreezesAvailable: 1, usedFreeze: true, streakBroken: false });

    // Day 11: days 9-10 were skipped (two missed days). Even with a
    // freeze still available, protection only covers exactly one missed
    // day, so the streak resets. longestStreakDays and the unused
    // freeze are preserved.
    result = await recordActiveDayForStreak(userId, addDays(base, 11));
    expect(result).toEqual({ currentStreakDays: 1, longestStreakDays: 8, streakFreezesAvailable: 1, usedFreeze: false, streakBroken: true });

    const status = await getStreakStatus(userId, addDays(base, 11));
    expect(status).toEqual({ currentStreakDays: 1, longestStreakDays: 8, trainedToday: true, daysSinceLastActive: 0 });

    const statusNextDay = await getStreakStatus(userId, addDays(base, 12));
    expect(statusNextDay).toEqual({ currentStreakDays: 1, longestStreakDays: 8, trainedToday: false, daysSinceLastActive: 1 });
  });
});

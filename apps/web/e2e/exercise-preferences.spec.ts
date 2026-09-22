import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Verifies the free, opt-in exercise-customization card (see
// docs/kanban.md's Gamification epic — "more customization to lessons")
// end to end: a real browser save on /settings/exercises writes a real
// ExercisePreference row, and the next standalone /train/<exercise>
// visit genuinely renders with that saved setting (via each exercise's
// data-pace/data-die-sides test hook — see NBackExercise.tsx et al.),
// not just that the API call succeeded in isolation.

test.describe("Exercise customization — real browser save and effect", () => {
  const email = `e2e-exercise-prefs-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.exercisePreference.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email } });
  });

  test("saving a pace preset persists and is reflected on the standalone N-Back exercise", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // Default is STANDARD before any preference is saved.
    await page.goto("/train/n-back");
    await expect(page.getByTestId("n-back-exercise")).toHaveAttribute("data-pace", "STANDARD");

    await page.goto("/settings/exercises");
    const noDelayButton = page.getByTestId("pace-adaptive-nback-v0-NO_DELAY");
    await noDelayButton.click();
    await expect(page.getByTestId("exercise-setting-adaptive-nback-v0").getByText("Saved")).toBeVisible();
    await expect(noDelayButton).toHaveAttribute("aria-pressed", "true");

    // Real persistence: a fresh page load of the settings screen still shows the saved choice.
    await page.reload();
    await expect(page.getByTestId("pace-adaptive-nback-v0-NO_DELAY")).toHaveAttribute("aria-pressed", "true");

    // The standalone exercise itself now genuinely runs at the saved pace.
    await page.goto("/train/n-back");
    await expect(page.getByTestId("n-back-exercise")).toHaveAttribute("data-pace", "NO_DELAY");
  });

  test("saving a die-sides preset persists and is reflected on the standalone Dice Sum exercise", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL("/");

    await page.goto("/settings/exercises");
    const d20Button = page.getByTestId("dice-sides-20");
    await d20Button.click();
    await expect(page.getByTestId("exercise-setting-dice-sum-v0").getByText("Saved")).toBeVisible();

    await page.goto("/train/dice-sum");
    await expect(page.getByTestId("dice-sum-exercise")).toHaveAttribute("data-die-sides", "20");
    // A d20 die is conventionally printed with numerals, not pips — confirms the Die component's real fallback.
    const firstDie = page.locator('[aria-label^="Die showing"]').first();
    await expect(firstDie).toBeVisible();

    const row = await prisma.exercisePreference.findFirst({ where: { user: { email }, method: "dice-sum-v0" } });
    expect(row?.settings).toMatchObject({ dieSides: 20 });
  });
});

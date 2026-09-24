import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// The Advanced tab (/advanced, apps/web/src/lib/advanced-settings.ts):
// real browser edits to an exercise's parameters persist, a lesson
// genuinely runs with them (grid size, trial count), and the finished
// lesson lands only in AdvancedRun — never in TrainingSession/Trial/
// DifficultyState/XpEntry, which is what keeps advanced lessons
// separate from main and daily training.

test.describe("Advanced tab — custom parameters, separate lesson history", () => {
  const email = `e2e-advanced-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  test("edits persist, the lesson runs with them, and it's recorded apart from main training", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: /Advanced training/ }).click();
    await expect(page).toHaveURL("/advanced");
    const nBackCard = page.getByTestId("advanced-lesson-adaptive-nback-v0");
    await expect(nBackCard).toContainText("Defaults");
    await nBackCard.click();
    await expect(page).toHaveURL("/advanced/n-back");

    // A short, fast, fixed-level lesson on a 4x4 grid.
    await page.getByTestId("advanced-param-gridSize-16").click();
    await page.getByTestId("advanced-param-adaptive").click();
    await page.getByTestId("advanced-param-trials").fill("10");
    await page.getByTestId("advanced-param-stimulusMs").fill("500");
    await page.getByTestId("advanced-param-feedbackMs").fill("0");
    await expect(page.getByTestId("advanced-value-trials")).toHaveText("10");
    await expect(page.getByTestId("advanced-configure").getByText("Saved")).toBeVisible();

    // Real persistence across a fresh load.
    await page.reload();
    await expect(page.getByTestId("advanced-param-gridSize-16")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("advanced-param-adaptive")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("advanced-value-stimulusMs")).toHaveText("500 ms");

    await page.getByTestId("advanced-start").click();
    const exercise = page.getByTestId("n-back-exercise");
    await expect(exercise).toBeVisible();
    await expect(page.getByText("Trial 1 of 10")).toBeVisible();
    // 16 grid cells rendered, not the standard 9.
    await expect(page.getByTestId("n-back-grid").locator("> div")).toHaveCount(16);

    await expect(page.getByTestId("advanced-result")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Advanced lesson complete")).toBeVisible();
    // Adaptation off: N stays at the starting level.
    await expect(page.getByTestId("advanced-result")).toContainText("2 → 2");

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await expect
      .poll(() => prisma.advancedRun.count({ where: { userId: user.id } }))
      .toBe(1);
    const run = await prisma.advancedRun.findFirstOrThrow({ where: { userId: user.id } });
    expect(run.method).toBe("adaptive-nback-v0");
    expect(run.settings).toMatchObject({ gridSize: 16, trials: 10, stimulusMs: 500, adaptive: false });
    expect(run.startLevel).toBe(2);
    expect(run.endLevel).toBe(2);

    // Separate from main/daily training: nothing written there.
    expect(await prisma.trainingSession.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.difficultyState.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.xpEntry.count({ where: { userId: user.id } })).toBe(0);

    await page.getByRole("link", { name: "Back to Advanced" }).click();
    await expect(page).toHaveURL("/advanced");
    await expect(page.getByTestId("advanced-lesson-adaptive-nback-v0")).toContainText("Custom");
    await expect(page.getByTestId("advanced-run")).toHaveCount(1);
  });

  test("the API clamps out-of-range values and rejects unknown methods", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL("/");

    const res = await page.request.put("/api/advanced/settings", {
      data: { method: "visuospatial-sequence-recall-v0", settings: { gridSize: 9, startLevel: 20, itemDisplayMs: 99999, bogus: 1 } },
    });
    expect(res.ok()).toBe(true);
    const { settings } = await res.json();
    // A sequence can't be longer than a 3x3 grid has cells.
    expect(settings.startLevel).toBe(9);
    expect(settings.itemDisplayMs).toBe(2000);
    expect(settings).not.toHaveProperty("bogus");

    const bad = await page.request.put("/api/advanced/settings", { data: { method: "not-a-method", settings: {} } });
    expect(bad.status()).toBe(400);
  });
});

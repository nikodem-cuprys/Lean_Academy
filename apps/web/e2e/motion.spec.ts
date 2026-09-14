import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Verifies docs/kanban.md's Animation/feedback pass card end to end in
// a real Chromium browser — animations can't be confirmed by
// build/typecheck alone (see CLAUDE.md's UI-verification note). Checks
// the two concrete, testable claims: the results-screen entrance
// animation actually runs (a real CSS animation-duration > 0, not just
// a className string that happens to exist), and prefers-reduced-motion
// collapses it to effectively instant, per docs/design-system.md's
// "every celebratory/decorative animation has a reduced or instant
// fallback."

const password = "correcthorsebattery123";

async function signUpAndReachNBackResults(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: /Try the N-Back exercise/ }).click();
  const respondButton = page.getByTestId("respond-button");
  for (let trial = 0; trial < 20; trial++) {
    await expect(respondButton).toBeEnabled({ timeout: 10_000 });
    await respondButton.click();
  }
  await expect(page.getByText("Exercise complete")).toBeVisible({ timeout: 15_000 });
}

test.afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [`e2e-motion-a-${test.info().project.name}@example.com`, `e2e-motion-b-${test.info().project.name}@example.com`] } },
  });
  await prisma.$disconnect();
});

test("results screen has a real, non-zero entrance animation by default", async ({ page }) => {
  const email = `e2e-motion-a-${Date.now()}@example.com`;
  await signUpAndReachNBackResults(page, email);

  const resultsRoot = page.getByTestId("results-screen");
  const animationDuration = await resultsRoot.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(animationDuration).not.toBe("0s");

  await prisma.user.deleteMany({ where: { email } });
});

test("button press feedback resolves to a real transition-duration (duration-micro didn't silently no-op)", async ({ page }) => {
  await page.goto("/login");
  // AuthForm's submit button carries transition-transform duration-micro
  // active:scale-95 — if the custom `--duration-micro` theme key ever
  // stopped resolving, this class would compile to zero effect with no
  // build error, so check the real computed value instead of just the
  // className string being present.
  const submitButton = page.locator('button[type="submit"]');
  const transitionDuration = await submitButton.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(transitionDuration).not.toBe("0s");
});

test("prefers-reduced-motion collapses the entrance animation to effectively instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = `e2e-motion-b-${Date.now()}@example.com`;
  await signUpAndReachNBackResults(page, email);

  const resultsRoot = page.getByTestId("results-screen");
  const animationDuration = await resultsRoot.evaluate((el) => getComputedStyle(el).animationDuration);
  // The global rule forces 0.01ms; parsed back from CSS this reads as "0.0000101s" — assert it's under 1ms either way.
  const seconds = parseFloat(animationDuration);
  expect(seconds).toBeLessThan(0.001);

  await prisma.user.deleteMany({ where: { email } });
});

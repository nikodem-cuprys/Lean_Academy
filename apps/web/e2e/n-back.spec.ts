import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Exercises the real client-side interaction loop (stimulus timing,
// tap-to-respond, the results transition) in an actual Chromium browser
// — the thing docs/kanban.md flagged as unverified after being built
// without a connected Claude-in-Chrome extension. Requires a running
// server (see CLAUDE.md's Commands section) with a real Postgres behind
// it; not run as part of `pnpm test` (that's vitest-only, unit tests).

const email = `e2e-nback-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("sign up, play a full N-Back run, and see an honest results screen", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Signup auto-signs-in and redirects home.
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Try the N-Back exercise/ }).click();
  await expect(page).toHaveURL(/\/train\/n-back/);
  await expect(page.getByText("WORKING MEMORY · N-BACK")).toBeVisible();

  // The 3x3 stimulus grid is really there.
  await expect(page.locator(".grid.w-\\[250px\\] > div")).toHaveCount(9);

  const respondButton = page.getByTestId("respond-button");

  // Tap every trial as soon as it's respondable — the button's own
  // disabled state (tied to phase !== "stimulus") makes Playwright's
  // auto-waiting click naturally pace itself to the real trial timing
  // instead of racing it.
  for (let trial = 0; trial < 20; trial++) {
    await expect(respondButton).toBeEnabled({ timeout: 10_000 });
    await respondButton.click();
  }

  await expect(page.getByText("Exercise complete")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("ACCURACY", { exact: true })).toBeVisible();
  await expect(page.getByText("LEVEL", { exact: true })).toBeVisible();
  // Since every trial was answered "match" — wrong on the ~62% of
  // trials that genuinely aren't — accuracy should be well under 100%,
  // present and plausible rather than any specific value.
  const accuracyText = await page
    .locator("text=ACCURACY")
    .locator("..")
    .textContent();
  expect(accuracyText).toMatch(/\d+%/);

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
});

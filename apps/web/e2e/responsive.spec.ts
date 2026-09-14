import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Phase 4's Mobile-responsive-web pass (see docs/kanban.md). Every
// other spec in this suite only ever ran under Playwright's Desktop
// Chrome default viewport — this is the first check of the app's fixed
// max-w-[390px] phone-card layout at a real mobile viewport, and the
// first confirmation that wide desktop viewports render it as an
// intentional centered card rather than something broken. Runs under
// both the "chromium" (desktop, ~1280px) and "mobile" (iPhone 13,
// 390px) Playwright projects — see playwright.config.ts — using the
// same assertions at both real widths rather than a single hardcoded
// viewport size.
//
// No specific tap-target-size number is given anywhere in this
// project's docs (checked docs/design-system.md, docs/testing.md,
// project_prompt.txt), so this uses the WCAG 2.2 AA "Target Size
// (Minimum)" success criterion — 24x24 CSS px — as the baseline,
// since it's the relevant published standard rather than an arbitrary
// number.

const MIN_TAP_TARGET_PX = 24;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  // A couple of px of slack for scrollbar/subpixel rounding, not a real overflow.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function expectTapTargetBigEnough(locator: ReturnType<Page["getByTestId"]>, label: string) {
  if ((await locator.count()) === 0) return; // not every control exists on every screen/state
  const box = await locator.first().boundingBox();
  expect(box, `missing bounding box for ${label}`).not.toBeNull();
  if (!box) return;
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
}

async function expectTapTargetsBigEnough(page: Page, testIds: string[]) {
  for (const testId of testIds) {
    await expectTapTargetBigEnough(page.getByTestId(testId), testId);
  }
}

const password = "correcthorsebattery123";
const email = `e2e-responsive-${Date.now()}@example.com`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("logged-out screens: no horizontal overflow, real tap targets", async ({ page }) => {
  await page.goto("/login");
  await expectNoHorizontalOverflow(page);
  await expectTapTargetBigEnough(page.getByPlaceholder("Email"), "email field");
  await expectTapTargetBigEnough(page.getByPlaceholder("Password"), "password field");
  await expectTapTargetBigEnough(page.locator('button[type="submit"]'), "Log in submit button");

  await page.goto("/signup");
  await expectNoHorizontalOverflow(page);
});

test("signed-in screens and an exercise: no horizontal overflow, real tap targets", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: /Start onboarding/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expectNoHorizontalOverflow(page);
  await expectTapTargetsBigEnough(page, ["goal-working-memory", "goals-continue"]);

  await page.goto("/progress");
  await expectNoHorizontalOverflow(page);

  await page.goto("/science");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "← Back home" }).click();
  await page.getByRole("link", { name: /Try the N-Back exercise/ }).click();
  await expect(page.getByTestId("respond-button")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectTapTargetsBigEnough(page, ["respond-button"]);
});

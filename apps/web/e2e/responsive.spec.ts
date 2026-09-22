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
// The fixed max-w-[390px] "phone card everywhere" description above no
// longer covers the whole app: the Home dashboard (apps/web/src/app/
// page.tsx) now genuinely reflows across phone/tablet/desktop — see the
// "Home dashboard" describe block below, which explicitly resizes the
// viewport through all three tiers in one real browser session rather
// than relying on which project happens to run it. Every other screen
// keeps the original fixed-card behavior this file already tests.
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

test.describe("Home dashboard: real device-responsive layout", () => {
  const email = `e2e-responsive-dashboard-${Date.now()}@example.com`;
  const password = "correcthorsebattery123";

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  test("phone, tablet, and desktop widths each render the right dashboard structure — one real DOM tree reflowing, not fabricated content", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    // Real onboarding so a real "Today's Training" card, weekly activity, etc. have something to show.
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
    await page.reload();

    const sidebar = page.getByRole("navigation", { name: "Main" });
    const weeklyStrip = page.getByTestId("weekly-activity-strip");
    const startTraining = page.getByRole("link", { name: "Start Training" });

    // Phone (<768px, Tailwind's `md`): no sidebar, no weekly-activity extras — the original scoped-down mobile experience, unchanged.
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(sidebar).toBeHidden();
    await expect(weeklyStrip).toBeHidden();
    await expect(startTraining).toBeVisible();
    await expectTapTargetBigEnough(startTraining, "Start Training button (phone)");

    // Tablet (768-1023px): still no sidebar (no dedicated design exists — see page.tsx's own comment), but the real weekly-activity strip now shows.
    await page.setViewportSize({ width: 820, height: 1180 });
    await expectNoHorizontalOverflow(page);
    await expect(sidebar).toBeHidden();
    await expect(weeklyStrip).toBeVisible();
    await expect(startTraining).toBeVisible();

    // Desktop (>=1024px): the real sidebar nav appears, matching prototype/HomeDesktop.dc.html's structure.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expect(sidebar).toBeVisible();
    await expect(weeklyStrip).toBeVisible();
    await expect(startTraining).toBeVisible();
    // Every real nav destination is a real link, not dead placeholder text.
    for (const label of ["Home", "Progress", "Science", "Achievements", "Quests & Challenges", "Customize exercises"]) {
      await expect(sidebar.getByRole("link", { name: label })).toBeVisible();
    }

    // Still exactly one real "Start Training" link and one real streak/level pill pair in the DOM at every width — not two parallel trees silently duplicating interactive elements.
    await expect(startTraining).toHaveCount(1);
    await expect(page.getByTestId("training-level-indicator")).toHaveCount(1);
  });
});

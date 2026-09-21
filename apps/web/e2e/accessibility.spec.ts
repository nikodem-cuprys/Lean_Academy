import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@lean-academy/db";

// Phase 4's Accessibility audit card (see docs/kanban.md) — automated
// axe-core scans (docs/testing.md calls for exactly this: "automated
// (axe-core or equivalent) in CI plus manual keyboard-navigation and
// screen-reader spot checks per release") across every real, built
// screen. Manual keyboard-navigation spot checks are done separately
// (see the "keyboard navigation" test below), since axe cannot detect
// "this div has an onClick but no keyboard handler" on its own — a
// non-interactive-looking element with a click handler doesn't violate
// any axe rule by default unless it's missing role/label entirely.

const password = "correcthorsebattery123";
const emails = {
  signedIn: `e2e-a11y-${Date.now()}@example.com`,
  keyboard: `e2e-a11y-kb-${Date.now()}@example.com`,
  nback: `e2e-a11y-nback-${Date.now()}@example.com`,
  complexSpan: `e2e-a11y-cspan-${Date.now()}@example.com`,
  diceSum: `e2e-a11y-dicesum-${Date.now()}@example.com`,
  spatial: `e2e-a11y-spatial-${Date.now()}@example.com`,
  reading: `e2e-a11y-reading-${Date.now()}@example.com`,
};

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await prisma.$disconnect();
});

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations;
}

test.describe("Accessibility (axe-core)", () => {
  test("logged-out screens: login, signup", async ({ page }) => {
    await page.goto("/login");
    expect(await scan(page)).toEqual([]);

    await page.goto("/signup");
    expect(await scan(page)).toEqual([]);
  });

  test("signed-in screens: home, onboarding, progress, science, achievements", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot");
    await page.getByPlaceholder("Email").fill(emails.signedIn);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    expect(await scan(page)).toEqual([]);

    await page.getByRole("link", { name: /Start onboarding/ }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    expect(await scan(page)).toEqual([]);

    await page.goto("/progress");
    expect(await scan(page)).toEqual([]);

    await page.goto("/science");
    expect(await scan(page)).toEqual([]);

    await page.goto("/achievements");
    expect(await scan(page)).toEqual([]);

    await page.goto("/assessments/backward-digit-span");
    expect(await scan(page)).toEqual([]);

    await page.goto("/assessments/backward-spatial-span");
    expect(await scan(page)).toEqual([]);

    await page.goto("/progress/trends");
    expect(await scan(page)).toEqual([]);
  });

  // All 4 exercises share the same domain-tag-text + domain-colored-
  // button pattern (e.g. "text-wm" + "bg-wm" with white on-accent
  // text) — each gets its own signed-up user and scan rather than
  // assuming a fix verified on one applies to the others.
  const exerciseCases: { name: string; email: string; linkPattern: RegExp; testId: string }[] = [
    { name: "N-Back", email: emails.nback, linkPattern: /Try the N-Back exercise/, testId: "respond-button" },
    { name: "Complex Span", email: emails.complexSpan, linkPattern: /Try the Complex Span exercise/, testId: "true-button" },
    { name: "Dice Sum", email: emails.diceSum, linkPattern: /Try the Dice Sum exercise/, testId: "hide-dice-button" },
    { name: "Spatial Sequence", email: emails.spatial, linkPattern: /Try the Spatial Sequence exercise/, testId: "grid-cell-0" },
    { name: "Paced Reading", email: emails.reading, linkPattern: /Try the Paced Reading exercise/, testId: "finish-reading-button" },
  ];

  for (const { name, email, linkPattern, testId } of exerciseCases) {
    test(`an exercise mid-run: ${name}`, async ({ page }) => {
      await page.goto("/signup");
      await page.getByPlaceholder("Name").fill(`E2E Bot ${name}`);
      await page.getByPlaceholder("Email").fill(email);
      await page.getByPlaceholder("Password").fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL("/");

      await page.getByRole("link", { name: linkPattern }).click();
      await expect(page.getByTestId(testId)).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test("keyboard navigation: onboarding goal options are reachable and activatable by keyboard", async ({ page }) => {
    await page.goto("/signup");
    await page.getByPlaceholder("Name").fill("E2E Bot 3");
    await page.getByPlaceholder("Email").fill(emails.keyboard);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: /Start onboarding/ }).click();

    // A goal option must be a real, focusable, keyboard-activatable
    // control (button/radio) — not a bare div with only an onClick
    // handler, which a keyboard-only or screen-reader user can't reach
    // at all. See docs/design-system.md's "Keyboard navigation across
    // the whole app" rule.
    const firstOption = page.getByTestId("goal-working-memory");
    await firstOption.focus();
    await expect(firstOption).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstOption).toHaveAttribute("aria-checked", "true");
  });
});

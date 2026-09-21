import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Same rationale as the other exercise specs: verifies the real
// client-side interaction loop (the show/answer/feedback phase loop,
// the numpad entry, scoring, results transition) in an actual Chromium
// browser. Requires a running production build with a real Postgres
// behind it; not run as part of `pnpm test` (vitest-only, unit tests).
//
// Answers every round correctly — it reads the actual dice faces shown
// (via each die's own aria-label) and types their real sum, so the run
// exercises a genuine correct-answer path against the real DiceSumTask
// scoring logic, not a guessed pattern.

const email = `e2e-dicesum-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

async function readDiceSum(page: Page): Promise<number> {
  const dice = page.getByRole("img", { name: /Die showing \d+/ });
  const count = await dice.count();
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const label = await dice.nth(i).getAttribute("aria-label");
    const match = label?.match(/\d+/);
    if (!match) throw new Error(`Could not parse a die face from aria-label: ${label}`);
    sum += Number(match[0]);
  }
  return sum;
}

test("sign up, play a full Dice Sum run with correct answers, and see an honest results screen", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Try the Dice Sum exercise/ }).click();
  await expect(page).toHaveURL(/\/train\/dice-sum/);
  await expect(page.getByText("WORKING MEMORY · DICE SUM")).toBeVisible();

  const hideDiceButton = page.getByTestId("hide-dice-button");
  const submitButton = page.getByTestId("answer-submit");

  for (let round = 0; round < 5; round++) {
    await expect(page.getByText(`Round ${round + 1} of 5`)).toBeVisible();
    await expect(hideDiceButton).toBeVisible({ timeout: 10_000 });
    const sum = await readDiceSum(page);
    await hideDiceButton.click();

    await expect(submitButton).toBeVisible({ timeout: 5_000 });
    for (const digit of String(sum)) {
      await page.getByTestId(`keypad-key-${digit}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText("Correct", { exact: true })).toBeVisible({ timeout: 5_000 });
  }

  await expect(page.getByText("Exercise complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("CORRECT SUMS")).toBeVisible();
  await expect(page.getByText("DICE COUNT", { exact: true })).toBeVisible();
  await expect(page.getByText("5/5")).toBeVisible(); // every round summed correctly

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
});

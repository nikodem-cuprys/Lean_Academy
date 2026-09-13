import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Same rationale as e2e/n-back.spec.ts: verifies the real client-side
// interaction loop (processing-item timing, memory-letter display,
// tap-to-recall, scoring, results transition) in an actual Chromium
// browser. Requires a running production server with a real Postgres
// behind it; not run as part of `pnpm test` (vitest-only, unit tests).
//
// Unlike the N-Back spec (which deliberately answers every trial
// "match" to get a plausible-but-imperfect accuracy), this spec reads
// each memory letter as it's shown and taps it back in the same
// order, so it exercises a genuine correct-recall path end to end
// against the real ComplexSpanTask scoring logic.

const email = `e2e-cspan-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("sign up, play full Complex Span sets with correct recall, and see an honest results screen", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Try the Complex Span exercise/ }).click();
  await expect(page).toHaveURL(/\/train\/complex-span/);
  await expect(page.getByText("WORKING MEMORY · COMPLEX SPAN")).toBeVisible();

  const trueButton = page.getByTestId("true-button");
  const memoryLetter = page.getByTestId("memory-letter");
  const submitButton = page.getByTestId("recall-submit");
  const letterChips = page.getByTestId("letter-chip");

  for (let set = 0; set < 5; set++) {
    await expect(page.getByText(`Set ${set + 1} of 5`)).toBeVisible();
    const setSize = await letterChips.count();

    const sequence: string[] = [];
    for (let i = 0; i < setSize; i++) {
      await expect(trueButton).toBeVisible({ timeout: 10_000 });
      await trueButton.click();

      await expect(memoryLetter).toBeVisible({ timeout: 10_000 });
      const letter = await memoryLetter.textContent();
      if (!letter) throw new Error("memory-letter had no text content");
      sequence.push(letter.trim());
      await expect(memoryLetter).toBeHidden({ timeout: 5_000 });
    }

    for (const letter of sequence) {
      await page.getByTestId(`recall-key-${letter}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  await expect(page.getByText("Exercise complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("PERFECT SETS")).toBeVisible();
  await expect(page.getByText("SPAN", { exact: true })).toBeVisible();
  await expect(page.getByText("5/5")).toBeVisible(); // every set recalled correctly

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
});

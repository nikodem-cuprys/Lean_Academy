import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Same rationale as e2e/n-back.spec.ts and e2e/complex-span.spec.ts:
// verifies the real client-side interaction loop (study-phase timing,
// tap-to-recall, scoring, results transition) in an actual Chromium
// browser. Requires a running production server with a real Postgres
// behind it; not run as part of `pnpm test` (vitest-only, unit tests).
//
// Like the Complex Span spec, this reads the sequence as it's actually
// shown (via the "highlighted-cell" test id, which echoes the
// currently-lit grid position) and taps it back in the same order, so
// it exercises a genuine correct-recall path end to end against the
// real SpatialSequenceTask scoring logic, rather than a fixed/guessed
// tap pattern.

const email = `e2e-spatial-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

async function captureStudySequence(page: Page): Promise<number[]> {
  const seen: number[] = [];
  let last: string | null = null;
  const highlightedCell = page.getByTestId("highlighted-cell");
  const submitButton = page.getByTestId("recall-submit");

  for (let i = 0; i < 200; i++) {
    if ((await submitButton.count()) > 0) break; // recall phase reached
    const value = await highlightedCell.textContent();
    if (value && value !== last) {
      seen.push(Number(value));
      last = value;
    }
    await page.waitForTimeout(50);
  }
  return seen;
}

test("sign up, play full Spatial Sequence rounds with correct recall, and see an honest results screen", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Try the Spatial Sequence exercise/ }).click();
  await expect(page).toHaveURL(/\/train\/spatial-sequence/);
  await expect(page.getByText("SPATIAL MEMORY · SEQUENCE RECALL")).toBeVisible();

  const submitButton = page.getByTestId("recall-submit");

  for (let round = 0; round < 5; round++) {
    await expect(page.getByText(`Sequence ${round + 1} of 5`)).toBeVisible();

    const sequence = await captureStudySequence(page);
    expect(sequence.length).toBeGreaterThan(0);

    await expect(submitButton).toBeVisible({ timeout: 10_000 });
    for (const position of sequence) {
      await page.getByTestId(`grid-cell-${position}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  await expect(page.getByText("Exercise complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("PERFECT SEQUENCES")).toBeVisible();
  await expect(page.getByText("SEQUENCE LENGTH", { exact: true })).toBeVisible();
  await expect(page.getByText("5/5")).toBeVisible(); // every round recalled correctly

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
});

import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { READING_PASSAGES } from "@lean-academy/reading-engine";

// Same rationale as the other exercise specs: verifies the real
// client-side interaction loop (the pacer, the finish-reading timing
// capture, the comprehension question, scoring, results transition) in
// an actual Chromium browser. Requires a running production server with
// a real Postgres behind it; not run as part of `pnpm test`.
//
// Answers every comprehension question correctly — it reads the actual
// question-prompt text back, matches it against the real passage bank
// to find that passage's correctIndex, and taps that choice — so the
// run exercises a genuine correct-comprehension path against the real
// PacedReadingTask scoring logic, not a guessed answer pattern.

const email = `e2e-reading-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("sign up, read full paced-reading passages with correct comprehension answers, and see an honest results screen", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /Try the Paced Reading exercise/ }).click();
  await expect(page).toHaveURL(/\/train\/reading/);
  await expect(page.getByText("READING · PACED PASSAGE")).toBeVisible();

  const finishReadingButton = page.getByTestId("finish-reading-button");
  const submitAnswerButton = page.getByTestId("submit-answer-button");

  for (let round = 0; round < 5; round++) {
    await expect(page.getByText(`Passage ${round + 1} of 5`)).toBeVisible();
    await expect(finishReadingButton).toBeVisible({ timeout: 10_000 });
    await finishReadingButton.click();

    const promptText = await page.getByTestId("question-prompt").textContent();
    const passage = READING_PASSAGES.find((p) => p.question.prompt === promptText);
    if (!passage) throw new Error(`Could not match question prompt to a known passage: ${promptText}`);

    await page.getByTestId(`answer-choice-${passage.question.correctIndex}`).click();
    await expect(submitAnswerButton).toBeEnabled();
    await submitAnswerButton.click();

    await expect(page.getByText("Correct", { exact: true })).toBeVisible({ timeout: 5_000 });
  }

  await expect(page.getByText("Exercise complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("AVG WPM")).toBeVisible();
  await expect(page.getByText("COMPREHENSION", { exact: true })).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible(); // every question answered correctly
  await expect(page.getByText("READING EFFICIENCY SCORE")).toBeVisible();

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
});

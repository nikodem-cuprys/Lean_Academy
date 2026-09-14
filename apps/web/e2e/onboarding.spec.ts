import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { READING_PASSAGES } from "@lean-academy/reading-engine";

// Exercises the full onboarding sequence end to end in a real Chromium
// browser: goals -> time -> experience -> calibration -> recommended
// level -> POST /api/onboarding/complete -> real DB rows. Unlike the
// exercise specs (which only exercise client-side scoring), this one
// also verifies the persistence side: a TrainingPlan, a DailyGoal, four
// DifficultyState rows (one per implemented task), and an
// AssessmentResult actually land in Postgres. Requires a running
// production server with a real Postgres behind it (`pnpm --filter
// @lean-academy/db seed` must have run at least once, so the
// TaskDefinition/TaskVersion rows this depends on exist).

const email = `e2e-onboarding-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
    await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
    await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
  }
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

// Polls continuously from before the sequence starts rather than doing
// discrete toBeVisible/toBeHidden checks per item — the calibration's
// memory-letter display (unlike the real ComplexSpanExercise) never
// actually hides between items (there's no processing step to gate it
// off), so a per-item visible/hidden pair would hang; polling handles
// arbitrary timing without assuming a gap exists between items.
async function captureTextSequence(page: Page, testId: string, submitTestId: string): Promise<string[]> {
  const seen: string[] = [];
  let last: string | null = null;
  const cell = page.getByTestId(testId);
  const submitButton = page.getByTestId(submitTestId);

  for (let i = 0; i < 200; i++) {
    if ((await submitButton.count()) > 0) break;
    const value = await cell.textContent().catch(() => null);
    if (value && value !== last) {
      seen.push(value);
      last = value;
    }
    await page.waitForTimeout(50);
  }
  return seen;
}

async function captureHighlightedSequence(page: Page, submitTestId: string): Promise<number[]> {
  const values = await captureTextSequence(page, "calibration-highlighted-cell", submitTestId);
  return values.map(Number);
}

test("complete the full onboarding flow and see real DB rows land", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: /Start onboarding/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1: goals
  await expect(page.getByText("STEP 1 OF 3")).toBeVisible();
  await page.getByTestId("goal-working-memory").click();
  await page.getByTestId("goals-continue").click();

  // Step 2: time
  await expect(page.getByText("STEP 2 OF 3")).toBeVisible();
  await page.getByTestId("time-10").click();
  await page.getByTestId("time-continue").click();

  // Step 3: experience
  await expect(page.getByText("STEP 3 OF 3")).toBeVisible();
  await page.getByTestId("experience-some").click();
  await page.getByTestId("experience-continue").click();

  // Calibration: 2 spatial rounds
  await expect(page.getByText("QUICK CALIBRATION")).toBeVisible();
  for (let round = 0; round < 2; round++) {
    const sequence = await captureHighlightedSequence(page, "calibration-spatial-submit");
    expect(sequence.length).toBeGreaterThan(0);
    for (const position of sequence) {
      await page.getByTestId(`calibration-grid-cell-${position}`).click();
    }
    await expect(page.getByTestId("calibration-spatial-submit")).toBeEnabled();
    await page.getByTestId("calibration-spatial-submit").click();
  }

  // Calibration: n-back (1 warm-up + 2 scoreable stimuli)
  const nbackYes = page.getByTestId("calibration-nback-yes");
  for (let i = 0; i < 2; i++) {
    await expect(nbackYes).toBeEnabled({ timeout: 10_000 });
    await nbackYes.click();
  }

  // Calibration: simple-span recall (3 letters)
  const letters = await captureTextSequence(page, "calibration-memory-letter", "calibration-complexspan-submit");
  expect(letters.length).toBeGreaterThan(0);
  for (const letter of letters) {
    await page.getByTestId(`calibration-recall-key-${letter}`).click();
  }
  await expect(page.getByTestId("calibration-complexspan-submit")).toBeEnabled();
  await page.getByTestId("calibration-complexspan-submit").click();

  // Calibration: one reading passage + question
  await expect(page.getByTestId("calibration-finish-reading")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("calibration-finish-reading").click();
  const promptText = await page.getByTestId("calibration-question-prompt").textContent();
  const passage = READING_PASSAGES.find((p) => p.question.prompt === promptText);
  if (!passage) throw new Error(`Could not match calibration question prompt: ${promptText}`);
  await page.getByTestId(`calibration-answer-choice-${passage.question.correctIndex}`).click();
  await page.getByTestId("calibration-submit-answer").click();

  // Recommended level -> finish
  await expect(page.getByText("We recommend starting at:")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("finish-onboarding").click();

  await expect(page).toHaveURL("/", { timeout: 15_000 });

  // Verify the real DB rows this flow is supposed to produce.
  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).not.toBeNull();

  const trainingPlan = await prisma.trainingPlan.findFirst({ where: { userId: user!.id, active: true } });
  expect(trainingPlan).not.toBeNull();
  expect(trainingPlan?.goals).toEqual(["working-memory"]);
  expect(trainingPlan?.experienceLevel).toBe("Some experience");

  const dailyGoal = await prisma.dailyGoal.findUnique({ where: { userId: user!.id } });
  expect(dailyGoal?.targetMinutes).toBe(10);

  const difficultyStates = await prisma.difficultyState.findMany({ where: { userId: user!.id } });
  expect(difficultyStates.length).toBe(4);

  const assessmentResult = await prisma.assessmentResult.findFirst({ where: { userId: user!.id } });
  expect(assessmentResult).not.toBeNull();
});

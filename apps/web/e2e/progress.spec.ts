import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { READING_PASSAGES } from "@lean-academy/reading-engine";

// Verifies docs/kanban.md's Progress page card end to end: the "nothing
// trained yet" empty state for a freshly onboarded user (calibration
// alone writes DifficultyState but no Trial rows), then real per-task
// progress after a full training session — reading's WPM/comprehension
// card and at least one non-reading "Trained" tab card, both sourced
// from the real Trial rows apps/web/e2e/session.spec.ts already proved
// land in Postgres.

test.setTimeout(180_000);

const email = `e2e-progress-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
    await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
    await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
    await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
  }
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

async function captureTextSequence(page: Page, testId: string, submitTestId: string): Promise<string[]> {
  const seen: string[] = [];
  let last: string | null = null;
  const cell = page.getByTestId(testId);
  const submitButton = page.getByTestId(submitTestId);
  for (let i = 0; i < 300; i++) {
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

async function captureSpatialHighlight(page: Page, testId = "calibration-highlighted-cell", submitId = "calibration-spatial-submit"): Promise<number[]> {
  const values = await captureTextSequence(page, testId, submitId);
  return values.map(Number);
}

async function completeOnboarding(page: Page) {
  await page.getByRole("link", { name: /Start onboarding/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByTestId("goal-balanced").click();
  await page.getByTestId("goals-continue").click();
  await page.getByTestId("time-10").click();
  await page.getByTestId("time-continue").click();
  await page.getByTestId("experience-some").click();
  await page.getByTestId("experience-continue").click();

  for (let round = 0; round < 2; round++) {
    const sequence = await captureSpatialHighlight(page);
    for (const position of sequence) {
      await page.getByTestId(`calibration-grid-cell-${position}`).click();
    }
    await page.getByTestId("calibration-spatial-submit").click();
  }

  const nbackYes = page.getByTestId("calibration-nback-yes");
  for (let i = 0; i < 2; i++) {
    await expect(nbackYes).toBeEnabled({ timeout: 10_000 });
    await nbackYes.click();
  }

  const letters = await captureTextSequence(page, "calibration-memory-letter", "calibration-complexspan-submit");
  for (const letter of letters) {
    await page.getByTestId(`calibration-recall-key-${letter}`).click();
  }
  await page.getByTestId("calibration-complexspan-submit").click();

  await expect(page.getByTestId("calibration-finish-reading")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("calibration-finish-reading").click();
  await page.getByTestId("calibration-answer-choice-0").click();
  await page.getByTestId("calibration-submit-answer").click();

  await expect(page.getByText("We recommend starting at:")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("finish-onboarding").click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

type ExerciseKind = "n-back" | "complex-span" | "spatial-sequence" | "reading";

async function detectExercise(page: Page): Promise<ExerciseKind> {
  const candidates: { kind: ExerciseKind; testId: string }[] = [
    { kind: "n-back", testId: "respond-button" },
    { kind: "complex-span", testId: "true-button" },
    { kind: "reading", testId: "finish-reading-button" },
    { kind: "spatial-sequence", testId: "grid-cell-0" },
  ];
  for (let i = 0; i < 200; i++) {
    for (const c of candidates) {
      if ((await page.getByTestId(c.testId).count()) > 0) return c.kind;
    }
    await page.waitForTimeout(50);
  }
  throw new Error("Timed out waiting to detect which exercise is showing");
}

async function driveNBack(page: Page) {
  const respondButton = page.getByTestId("respond-button");
  for (let trial = 0; trial < 20; trial++) {
    await expect(respondButton).toBeEnabled({ timeout: 10_000 });
    await respondButton.click();
  }
}

async function driveComplexSpan(page: Page) {
  const trueButton = page.getByTestId("true-button");
  const memoryLetter = page.getByTestId("memory-letter");
  const submitButton = page.getByTestId("recall-submit");
  const letterChips = page.getByTestId("letter-chip");
  for (let set = 0; set < 5; set++) {
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
}

async function driveSpatialSequence(page: Page) {
  const submitButton = page.getByTestId("recall-submit");
  for (let round = 0; round < 5; round++) {
    const sequence = await captureSpatialHighlight(page, "highlighted-cell", "recall-submit");
    for (const position of sequence) {
      await page.getByTestId(`grid-cell-${position}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }
}

async function driveReading(page: Page) {
  const finishReadingButton = page.getByTestId("finish-reading-button");
  const submitAnswerButton = page.getByTestId("submit-answer-button");
  for (let round = 0; round < 5; round++) {
    await expect(finishReadingButton).toBeVisible({ timeout: 10_000 });
    await finishReadingButton.click();
    const promptText = await page.getByTestId("question-prompt").textContent();
    const passage = READING_PASSAGES.find((p) => p.question.prompt === promptText);
    if (!passage) throw new Error(`Could not match question prompt to a known passage: ${promptText}`);
    await page.getByTestId(`answer-choice-${passage.question.correctIndex}`).click();
    await expect(submitAnswerButton).toBeEnabled();
    await submitAnswerButton.click();
  }
}

test("Progress page shows an honest empty state after calibration, then real data after a session", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await completeOnboarding(page);

  // Right after onboarding: DifficultyState rows exist (from
  // calibration) but zero Trial rows — the Progress page must not
  // fabricate a training history from calibration alone.
  await page.goto("/progress");
  await expect(page.getByText("Progress", { exact: true })).toBeVisible();
  await expect(page.getByText(/Calibrated at Level \d+ — no training sessions yet/).first()).toBeVisible();

  // Run one full training session so real Trial rows exist.
  await page.goto("/");
  await page.getByRole("link", { name: "Start Training" }).click();
  await expect(page).toHaveURL(/\/train\/session/);
  for (let step = 0; step < 3; step++) {
    const kind = await detectExercise(page);
    if (kind === "n-back") await driveNBack(page);
    else if (kind === "complex-span") await driveComplexSpan(page);
    else if (kind === "spatial-sequence") await driveSpatialSequence(page);
    else await driveReading(page);
    if (step < 2) {
      await expect(page.getByText("Nice work")).toBeVisible({ timeout: 10_000 });
    }
  }
  await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });

  // Reading only shows a before/after comparison once 2+ sessions with
  // reading trials exist in the window, so run a second session too.
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Start Training" }).click();
  for (let step = 0; step < 3; step++) {
    const kind = await detectExercise(page);
    if (kind === "n-back") await driveNBack(page);
    else if (kind === "complex-span") await driveComplexSpan(page);
    else if (kind === "spatial-sequence") await driveSpatialSequence(page);
    else await driveReading(page);
    if (step < 2) {
      await expect(page.getByText("Nice work")).toBeVisible({ timeout: 10_000 });
    }
  }
  await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Done" }).click();

  await page.goto("/progress");
  await expect(page.getByText("READING — LAST 30 DAYS")).toBeVisible();
  await expect(page.getByText("PACE", { exact: true })).toBeVisible();
  await expect(page.getByText("COMPREHENSION", { exact: true })).toBeVisible();
  await expect(page.getByText(/WPM/)).toBeVisible();

  await page.getByTestId("progress-tab-trained").click();
  // At least one non-reading trained task (spatial sequence is in every
  // session regardless of which WORKING_MEMORY exercise got picked)
  // should show real level progress, not the "calibrated, no sessions
  // yet" placeholder.
  await expect(
    page.getByText(/Level \d+ → Level \d+ over \d+ session/).or(page.getByText(/-item → \d+-item best span/)).first()
  ).toBeVisible();

  // Verify against the real DB directly too.
  const user = await prisma.user.findUnique({ where: { email } });
  const trials = await prisma.trial.findMany({ where: { trainingSession: { userId: user!.id } } });
  expect(trials.length).toBeGreaterThan(0);
});

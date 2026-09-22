import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { READING_PASSAGES } from "@lean-academy/reading-engine";

// docs/kanban.md's "Expand and rotate the reading-passage bank" card —
// verifies the real cross-session rotation end to end, not just the
// unit-level ordering logic. Standalone /train/reading never persists
// Trial rows (same as every other exercise's standalone route — see
// CLAUDE.md), and the rotation is computed from real Trial history, so
// this has to drive two full orchestrated sessions (/train/session,
// same technique as e2e/session.spec.ts and e2e/progress.spec.ts) to
// produce two real reading segments to compare — a real cost, but the
// only way to prove the actual persisted-history-driven behavior,
// not just the pure-function unit tests already covering the ordering
// math in packages/reading-engine.

test.setTimeout(180_000);

const email = `e2e-reading-rotation-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.trial.deleteMany({ where: { trainingSession: { userId: user.id } } });
    await prisma.trainingSession.deleteMany({ where: { userId: user.id } });
    await prisma.difficultyState.deleteMany({ where: { userId: user.id } });
    await prisma.dailyGoal.deleteMany({ where: { userId: user.id } });
    await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });
    await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
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

type ExerciseKind = "n-back" | "complex-span" | "spatial-sequence" | "reading" | "dice-sum";

async function detectExercise(page: Page): Promise<ExerciseKind> {
  const candidates: { kind: ExerciseKind; testId: string }[] = [
    { kind: "n-back", testId: "respond-button" },
    { kind: "complex-span", testId: "true-button" },
    { kind: "reading", testId: "finish-reading-button" },
    { kind: "spatial-sequence", testId: "grid-cell-0" },
    { kind: "dice-sum", testId: "hide-dice-button" },
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

async function driveDiceSum(page: Page) {
  const hideDiceButton = page.getByTestId("hide-dice-button");
  const submitButton = page.getByTestId("answer-submit");
  for (let round = 0; round < 5; round++) {
    await expect(hideDiceButton).toBeVisible({ timeout: 10_000 });
    const dice = page.getByRole("img", { name: /Die showing \d+/ });
    const diceCount = await dice.count();
    let sum = 0;
    for (let i = 0; i < diceCount; i++) {
      const label = await dice.nth(i).getAttribute("aria-label");
      const match = label?.match(/\d+/);
      if (!match) throw new Error(`Could not parse a die face from aria-label: ${label}`);
      sum += Number(match[0]);
    }
    await hideDiceButton.click();
    await expect(submitButton).toBeVisible({ timeout: 5_000 });
    for (const digit of String(sum)) {
      await page.getByTestId(`keypad-key-${digit}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }
}

/** Same as the other specs' driveReading, but returns the real passage ids read, in order — the thing this test actually needs to check. */
async function driveReadingCapturingIds(page: Page): Promise<string[]> {
  const finishReadingButton = page.getByTestId("finish-reading-button");
  const submitAnswerButton = page.getByTestId("submit-answer-button");
  const ids: string[] = [];
  for (let round = 0; round < 5; round++) {
    await expect(finishReadingButton).toBeVisible({ timeout: 10_000 });
    await finishReadingButton.click();
    const promptText = await page.getByTestId("question-prompt").textContent();
    const passage = READING_PASSAGES.find((p) => p.question.prompt === promptText);
    if (!passage) throw new Error(`Could not match question prompt to a known passage: ${promptText}`);
    ids.push(passage.id);
    await page.getByTestId(`answer-choice-${passage.question.correctIndex}`).click();
    await expect(submitAnswerButton).toBeEnabled();
    await submitAnswerButton.click();
  }
  return ids;
}

async function runOneSession(page: Page): Promise<string[] | null> {
  await page.goto("/");
  await page.getByRole("link", { name: "Start Training" }).click();
  await expect(page).toHaveURL(/\/train\/session/);
  let readingIds: string[] | null = null;
  for (let step = 0; step < 3; step++) {
    const kind = await detectExercise(page);
    if (kind === "n-back") await driveNBack(page);
    else if (kind === "complex-span") await driveComplexSpan(page);
    else if (kind === "spatial-sequence") await driveSpatialSequence(page);
    else if (kind === "dice-sum") await driveDiceSum(page);
    else readingIds = await driveReadingCapturingIds(page);
    if (step < 2) {
      await expect(page.getByText("Nice work")).toBeVisible({ timeout: 10_000 });
    }
  }
  await expect(page.getByText("Session complete")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");
  return readingIds;
}

test("a second real session reads the least-recently-seen passages first, not a repeat of the same ones", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await completeOnboarding(page);

  const firstRun = await runOneSession(page);
  if (!firstRun) throw new Error("First session didn't include a reading segment — getTodaysTraining picked no READING exercise");
  expect(new Set(firstRun).size).toBe(5); // no repeats within one run

  const secondRun = await runOneSession(page);
  if (!secondRun) throw new Error("Second session didn't include a reading segment");

  const unseenAfterFirstRun = READING_PASSAGES.map((p) => p.id).filter((id) => !firstRun.includes(id));
  expect(unseenAfterFirstRun.length).toBe(READING_PASSAGES.length - 5);

  // The real rotation: every passage never read in the first run must
  // come before any repeat in the second run. The bank may hold more
  // than two sessions' worth of passages (it's grown since this test
  // was first written — see docs/kanban.md's reading-passage-bank
  // card), in which case a whole second run can be filled by genuinely
  // unseen passages with no repeat happening yet at all; this asserts
  // exactly that many of the second run's reads are unseen, whether
  // that's the full run or fewer.
  const expectedUnseenInSecondRun = Math.min(unseenAfterFirstRun.length, secondRun.length);
  const secondRunFirstBatch = secondRun.slice(0, expectedUnseenInSecondRun);
  expect(secondRunFirstBatch.length).toBe(expectedUnseenInSecondRun);
  expect(new Set(secondRunFirstBatch).size).toBe(expectedUnseenInSecondRun); // no repeats among them
  for (const id of secondRunFirstBatch) {
    expect(unseenAfterFirstRun).toContain(id);
  }

  // Once the never-seen ones are exhausted (only reachable once the
  // bank is small enough relative to one session), the least-recently-
  // seen of the already-read passages is whichever one was read
  // *first* in the first run (furthest in the past by the time the
  // second run starts).
  const remainder = secondRun.slice(expectedUnseenInSecondRun);
  if (remainder.length > 0) {
    expect(remainder[0]).toBe(firstRun[0]);
  }

  // Cross-check against the real DB directly: the Trial rows' own
  // passageId metadata, in real chronological order, must match what
  // the browser actually showed.
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const readingTrials = await prisma.trial.findMany({
    where: {
      trainingSession: { userId: user.id },
      taskVersion: { taskDefinition: { method: "reading-paced-adaptive-v0" } },
    },
    orderBy: { stimulusStartedAt: "asc" },
    select: { metadata: true },
  });
  const passageIdsInDb = readingTrials.map((t) => (t.metadata as { passageId?: string } | null)?.passageId);
  expect(passageIdsInDb).toEqual([...firstRun, ...secondRun]);
});

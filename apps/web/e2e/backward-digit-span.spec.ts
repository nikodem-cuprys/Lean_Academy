import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Same rationale as e2e/spatial-sequence.spec.ts: verifies the real
// client-side interaction loop (study-phase timing, tap-to-recall,
// staircase scoring, results transition) in an actual Chromium browser,
// plus the real Assessment/AssessmentResult DB rows and the periodic
// "last taken" status text on a second visit — this is the first spec
// to check that status message, since no prior assessment route showed
// one. Requires a running production server with a real Postgres
// behind it; not run as part of `pnpm test` (vitest-only, unit tests).
//
// Reads the digit sequence as it's actually shown (via the
// "study-digit" test id) and taps it back in reverse order every
// trial, so the bot always succeeds and the staircase runs all the way
// to the ceiling (max span) — a genuine correct-recall path through the
// real BackwardDigitSpanAssessment engine, same technique already
// proven on the Spatial Sequence spec. The failure-termination path
// (two consecutive misses) is covered by packages/cognitive-engine's
// own unit tests instead of here, matching how this project already
// splits "genuine browser interaction + persistence" (e2e) from
// "engine edge cases" (unit tests).

const email = `e2e-backward-digit-span-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.assessmentResult.deleteMany({ where: { userId: user.id } });
  }
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

// Near-transfer assessments are premium-gated (docs/kanban.md's
// "Entitlement system" card) — no Stripe integration exists yet to
// reach a real PREMIUM subscription through the UI, so this grants one
// directly via Prisma, the same "direct call/write for a state an
// external dependency this suite doesn't manage would otherwise gate"
// pattern already used elsewhere (e.g. personal-bests.spec.ts).
async function grantPremium(userEmail: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
    update: { plan: "PREMIUM_MONTHLY", status: "ACTIVE" },
  });
}

async function captureStudySequence(page: Page): Promise<number[]> {
  const seen: number[] = [];
  let last: string | null = null;
  const studyDigit = page.getByTestId("study-digit");
  const submitButton = page.getByTestId("recall-submit");

  for (let i = 0; i < 400; i++) {
    if ((await submitButton.count()) > 0) break; // recall phase reached
    // The count() check alone isn't enough — study-digit can still
    // detach between it and the textContent() call below (a real,
    // reproducible flake independent of any app change: confirmed by
    // running this same race against an unmodified build), which hangs
    // textContent()'s auto-wait indefinitely. .catch(() => null) treats
    // that detach as "no value yet" and lets the loop re-check next
    // tick, the same safe pattern e2e/progress.spec.ts's
    // captureTextSequence already uses.
    if ((await studyDigit.count()) > 0) {
      const value = await studyDigit.textContent().catch(() => null);
      if (value && value !== last) {
        seen.push(Number(value));
        last = value;
      }
    }
    await page.waitForTimeout(50);
  }
  return seen;
}

test("sign up, run the full staircase with correct backward recall to the ceiling, and see the real DB result", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in", { exact: true })).toBeVisible();
  await grantPremium(email);

  await page.goto("/assessments/backward-digit-span");
  await expect(page.getByText("Backward Digit Span")).toBeVisible();
  await expect(page.getByText("You haven't taken this assessment yet.")).toBeVisible();
  await page.getByTestId("start-assessment").click();

  const submitButton = page.getByTestId("recall-submit");
  const resultsScreen = page.getByTestId("results-screen");

  while ((await resultsScreen.count()) === 0) {
    const sequence = await captureStudySequence(page);
    if (sequence.length === 0) break; // safety valve against an infinite loop on a real bug
    await expect(submitButton).toBeVisible({ timeout: 10_000 });
    for (const digit of [...sequence].reverse()) {
      await page.getByTestId(`digit-key-${digit}`).click();
    }
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await page.waitForTimeout(1300); // clears the feedback pause before the next trial (or results) renders
  }

  await expect(page.getByText("Assessment complete")).toBeVisible({ timeout: 15_000 });
  // Every trial answered with the genuine reversed sequence, so the
  // staircase must have run all the way to the max span (ceiling).
  await expect(page.getByTestId("final-span")).toHaveText("9");
  await expect(page.getByText("1/1")).toBeVisible(); // exactly one attempt at the ceiling, and it was correct

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL("/");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const assessment = await prisma.assessment.findFirstOrThrow({
    where: { type: "NEAR_TRANSFER", name: "Backward Digit Span" },
  });
  const result = await prisma.assessmentResult.findFirstOrThrow({
    where: { userId: user.id, assessmentId: assessment.id },
  });
  const scoreSummary = result.scoreSummary as {
    finalSpan: number;
    finalSpanCorrect: number;
    finalSpanTrials: number;
    confidenceInterval: { proportion: number; lower: number; upper: number };
  };
  expect(scoreSummary.finalSpan).toBe(9);
  expect(scoreSummary.finalSpanCorrect).toBe(1);
  expect(scoreSummary.finalSpanTrials).toBe(1);
  expect(scoreSummary.confidenceInterval.proportion).toBe(1);

  // A second visit shows the real "last taken" status, not due yet
  // (14-day rule — see apps/web/src/lib/near-transfer-assessment.ts).
  await page.goto("/assessments/backward-digit-span");
  await expect(page.getByTestId("assessment-status")).toContainText("Last taken");
  await expect(page.getByTestId("assessment-status")).toContainText("next recommended around");
});

import { describe, expect, it } from "vitest";
import {
  BackwardDigitSpanAssessment,
  BACKWARD_DIGIT_SPAN_MAX,
  BACKWARD_DIGIT_SPAN_START,
} from "./backward-digit-span";

describe("BackwardDigitSpanAssessment — trial lifecycle", () => {
  it("throws if submitRecall is called before nextTrialDigits", () => {
    const assessment = new BackwardDigitSpanAssessment();
    expect(() => assessment.submitRecall([])).toThrow();
  });

  it("throws if nextTrialDigits is called twice without a submitRecall in between", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    assessment.nextTrialDigits();
    expect(() => assessment.nextTrialDigits()).toThrow();
  });

  it("throws if getScore is called before the assessment completes", () => {
    const assessment = new BackwardDigitSpanAssessment();
    expect(() => assessment.getScore()).toThrow();
  });

  it("starts at BACKWARD_DIGIT_SPAN_START and never repeats a digit within one sequence (random always 0)", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_START);
    const digits = assessment.nextTrialDigits();
    expect(digits).toEqual([0, 1, 2]); // first 3 of the digit pool, in order
    expect(new Set(digits).size).toBe(3);
  });
});

describe("BackwardDigitSpanAssessment — scoring", () => {
  it("scores a correct backward recall and increases the span by one", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    const digits = assessment.nextTrialDigits(); // [0, 1, 2]
    const outcome = assessment.submitRecall([...digits].reverse());
    expect(outcome.correct).toBe(true);
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_START + 1);
  });

  it("scores an incorrect (forward-order) recall as wrong without completing after one failure", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    const digits = assessment.nextTrialDigits();
    const outcome = assessment.submitRecall(digits); // forward order — wrong for backward recall
    expect(outcome.correct).toBe(false);
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_START); // retried at the same span
  });

  it("completes after two consecutive failures at the same span, reporting the last successful span", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });

    // Trial 1 at span 3: succeed.
    const first = assessment.nextTrialDigits();
    expect(assessment.submitRecall([...first].reverse()).isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_START + 1);

    // Trial 2 at span 4: fail.
    const second = assessment.nextTrialDigits();
    expect(assessment.submitRecall(second).isComplete).toBe(false); // one failure — retry, not complete

    // Trial 3 (retry) at span 4: fail again — two consecutive failures.
    const third = assessment.nextTrialDigits();
    const outcome = assessment.submitRecall(third);
    expect(outcome.isComplete).toBe(true);
    expect(assessment.isComplete()).toBe(true);

    const score = assessment.getScore();
    expect(score.finalSpan).toBe(BACKWARD_DIGIT_SPAN_START); // last span actually passed
    expect(score.totalTrials).toBe(3);
    expect(score.totalCorrect).toBe(1);
    expect(score.finalSpanTrials).toBe(2); // both attempts at the terminal span
    expect(score.finalSpanCorrect).toBe(0);
  });

  it("a single failure followed by a success at the same span moves on, discarding that span's partial record", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    const first = assessment.nextTrialDigits();
    assessment.submitRecall(first); // fail (forward order)
    const retry = assessment.nextTrialDigits();
    const outcome = assessment.submitRecall([...retry].reverse()); // succeed on retry
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_START + 1);
  });

  it("completes at the ceiling if the max span is recalled correctly, with a 1/1 final-span record", () => {
    const assessment = new BackwardDigitSpanAssessment({
      random: () => 0,
      // Not used directly — succeeding every trial up to the max span.
    });
    let outcome;
    for (let span = BACKWARD_DIGIT_SPAN_START; span <= BACKWARD_DIGIT_SPAN_MAX; span++) {
      const digits = assessment.nextTrialDigits();
      outcome = assessment.submitRecall([...digits].reverse());
    }
    expect(outcome!.isComplete).toBe(true);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_DIGIT_SPAN_MAX);

    const score = assessment.getScore();
    expect(score.finalSpan).toBe(BACKWARD_DIGIT_SPAN_MAX);
    expect(score.finalSpanTrials).toBe(1);
    expect(score.finalSpanCorrect).toBe(1);
  });

  it("reports finalSpan 0 if the user fails twice at the very first (starting) span", () => {
    const assessment = new BackwardDigitSpanAssessment({ random: () => 0 });
    const first = assessment.nextTrialDigits();
    assessment.submitRecall(first); // fail
    const second = assessment.nextTrialDigits();
    const outcome = assessment.submitRecall(second); // fail again
    expect(outcome.isComplete).toBe(true);
    expect(assessment.getScore().finalSpan).toBe(0);
  });

  it("statistically: recalling the true reversed sequence is scored correct across many randomized trials", () => {
    let successes = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const assessment = new BackwardDigitSpanAssessment();
      const digits = assessment.nextTrialDigits();
      const outcome = assessment.submitRecall([...digits].reverse());
      if (outcome.correct) successes++;
    }
    expect(successes).toBe(runs); // the true reversed sequence must always score correct
  });
});

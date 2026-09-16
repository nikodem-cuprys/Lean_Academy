import { describe, expect, it } from "vitest";
import {
  BackwardSpatialSpanAssessment,
  BACKWARD_SPATIAL_SPAN_MAX,
  BACKWARD_SPATIAL_SPAN_START,
} from "./backward-spatial-span";

describe("BackwardSpatialSpanAssessment — trial lifecycle", () => {
  it("throws if submitRecall is called before nextTrialPositions", () => {
    const assessment = new BackwardSpatialSpanAssessment();
    expect(() => assessment.submitRecall([])).toThrow();
  });

  it("throws if nextTrialPositions is called twice without a submitRecall in between", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    assessment.nextTrialPositions();
    expect(() => assessment.nextTrialPositions()).toThrow();
  });

  it("throws if getScore is called before the assessment completes", () => {
    const assessment = new BackwardSpatialSpanAssessment();
    expect(() => assessment.getScore()).toThrow();
  });

  it("starts at BACKWARD_SPATIAL_SPAN_START and never repeats a position within one sequence (random always 0)", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_START);
    const positions = assessment.nextTrialPositions();
    expect(positions).toEqual([0, 1, 2]); // first 3 grid cells, in order
    expect(new Set(positions).size).toBe(3);
  });
});

describe("BackwardSpatialSpanAssessment — scoring", () => {
  it("scores a correct backward recall and increases the span by one", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    const positions = assessment.nextTrialPositions(); // [0, 1, 2]
    const outcome = assessment.submitRecall([...positions].reverse());
    expect(outcome.correct).toBe(true);
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_START + 1);
  });

  it("scores an incorrect (forward-order) recall as wrong without completing after one failure", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    const positions = assessment.nextTrialPositions();
    const outcome = assessment.submitRecall(positions); // forward order — wrong for backward recall
    expect(outcome.correct).toBe(false);
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_START); // retried at the same span
  });

  it("completes after two consecutive failures at the same span, reporting the last successful span", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });

    const first = assessment.nextTrialPositions();
    expect(assessment.submitRecall([...first].reverse()).isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_START + 1);

    const second = assessment.nextTrialPositions();
    expect(assessment.submitRecall(second).isComplete).toBe(false); // one failure — retry, not complete

    const third = assessment.nextTrialPositions();
    const outcome = assessment.submitRecall(third);
    expect(outcome.isComplete).toBe(true);
    expect(assessment.isComplete()).toBe(true);

    const score = assessment.getScore();
    expect(score.finalSpan).toBe(BACKWARD_SPATIAL_SPAN_START);
    expect(score.totalTrials).toBe(3);
    expect(score.totalCorrect).toBe(1);
    expect(score.finalSpanTrials).toBe(2);
    expect(score.finalSpanCorrect).toBe(0);
  });

  it("a single failure followed by a success at the same span moves on, discarding that span's partial record", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    const first = assessment.nextTrialPositions();
    assessment.submitRecall(first); // fail (forward order)
    const retry = assessment.nextTrialPositions();
    const outcome = assessment.submitRecall([...retry].reverse()); // succeed on retry
    expect(outcome.isComplete).toBe(false);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_START + 1);
  });

  it("completes at the ceiling (grid size) if the max span is recalled correctly, with a 1/1 final-span record", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    let outcome;
    for (let span = BACKWARD_SPATIAL_SPAN_START; span <= BACKWARD_SPATIAL_SPAN_MAX; span++) {
      const positions = assessment.nextTrialPositions();
      outcome = assessment.submitRecall([...positions].reverse());
    }
    expect(outcome!.isComplete).toBe(true);
    expect(assessment.getCurrentSpan()).toBe(BACKWARD_SPATIAL_SPAN_MAX);

    const score = assessment.getScore();
    expect(score.finalSpan).toBe(BACKWARD_SPATIAL_SPAN_MAX);
    expect(score.finalSpanTrials).toBe(1);
    expect(score.finalSpanCorrect).toBe(1);
  });

  it("reports finalSpan 0 if the user fails twice at the very first (starting) span", () => {
    const assessment = new BackwardSpatialSpanAssessment({ random: () => 0 });
    const first = assessment.nextTrialPositions();
    assessment.submitRecall(first); // fail
    const second = assessment.nextTrialPositions();
    const outcome = assessment.submitRecall(second); // fail again
    expect(outcome.isComplete).toBe(true);
    expect(assessment.getScore().finalSpan).toBe(0);
  });

  it("every generated position is a valid grid index (0-8) across many randomized trials", () => {
    for (let i = 0; i < 200; i++) {
      const assessment = new BackwardSpatialSpanAssessment();
      const positions = assessment.nextTrialPositions();
      for (const p of positions) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(9);
      }
    }
  });

  it("statistically: recalling the true reversed sequence is scored correct across many randomized trials", () => {
    let successes = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const assessment = new BackwardSpatialSpanAssessment();
      const positions = assessment.nextTrialPositions();
      const outcome = assessment.submitRecall([...positions].reverse());
      if (outcome.correct) successes++;
    }
    expect(successes).toBe(runs);
  });
});

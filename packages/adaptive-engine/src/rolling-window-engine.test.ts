import { describe, expect, it } from "vitest";
import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type RollingWindowConfig,
} from "./rolling-window-engine";
import type { TrialResult } from "./types";

function trial(correct: boolean): TrialResult {
  return { correct, timestamp: Date.now() };
}

function engine(overrides: Partial<RollingWindowConfig> = {}) {
  return new RollingWindowAdaptiveEngine({
    initialDifficulty: 3,
    minDifficulty: 1,
    maxDifficulty: 10,
    ...DEFAULT_ROLLING_WINDOW_CONFIG,
    ...overrides,
  });
}

describe("RollingWindowAdaptiveEngine", () => {
  it("never changes difficulty before the window is full — no single-trial swings", () => {
    const e = engine();
    e.recordTrial(trial(true));
    expect(e.recommendNextDifficulty()).toBe(3);
    e.recordTrial(trial(false));
    expect(e.recommendNextDifficulty()).toBe(3);
    // Still short of windowSize (8)
    e.recordTrial(trial(true));
    e.recordTrial(trial(true));
    expect(e.recommendNextDifficulty()).toBe(3);
  });

  it("steps up by exactly one level once a full window is consistently strong", () => {
    const e = engine();
    for (let i = 0; i < 8; i++) e.recordTrial(trial(true)); // 100% over window
    expect(e.recommendNextDifficulty()).toBe(4);
  });

  it("steps down by exactly one level once a full window is consistently weak", () => {
    const e = engine();
    for (let i = 0; i < 8; i++) e.recordTrial(trial(false)); // 0% over window
    expect(e.recommendNextDifficulty()).toBe(2);
  });

  it("does not change difficulty in the comfortable middle band", () => {
    const e = engine();
    // 5/8 correct = 62.5% accuracy, between decreaseThreshold(0.5) and increaseThreshold(0.8)
    [true, true, true, true, true, false, false, false].forEach((c) => e.recordTrial(trial(c)));
    expect(e.recommendNextDifficulty()).toBe(3);
  });

  it("never exceeds maxDifficulty", () => {
    const e = engine({ initialDifficulty: 10 });
    for (let i = 0; i < 15; i++) {
      e.recordTrial(trial(true));
      e.recommendNextDifficulty();
    }
    expect(e.getCurrentDifficulty()).toBe(10);
  });

  it("never drops below minDifficulty", () => {
    const e = engine({ initialDifficulty: 1 });
    for (let i = 0; i < 15; i++) {
      e.recordTrial(trial(false));
      e.recommendNextDifficulty();
    }
    expect(e.getCurrentDifficulty()).toBe(1);
  });

  it("resets the window after a change, requiring a fresh full window before the next one", () => {
    const e = engine();
    for (let i = 0; i < 8; i++) e.recordTrial(trial(true));
    expect(e.recommendNextDifficulty()).toBe(4); // triggers a step + window reset

    // Only 2 trials recorded since the reset — must not step again yet.
    e.recordTrial(trial(true));
    e.recordTrial(trial(true));
    expect(e.recommendNextDifficulty()).toBe(4);
  });

  it("calculatePerformance reports accuracy over ALL recorded trials, not just the rolling window", () => {
    const e = engine();
    [true, true, true, true, true, false, false].forEach((c) =>
      e.recordTrial(trial(c))
    );
    const perf = e.calculatePerformance();
    expect(perf.trialCount).toBe(7);
    expect(perf.accuracy).toBeCloseTo(5 / 7);
  });

  it("tracks mean reaction time only over trials that reported one", () => {
    const e = engine();
    e.recordTrial({ correct: true, timestamp: 1, reactionTimeMs: 400 });
    e.recordTrial({ correct: true, timestamp: 2, reactionTimeMs: 600 });
    e.recordTrial({ correct: true, timestamp: 3 }); // no RT (e.g. reading task)
    expect(e.calculatePerformance().meanReactionTimeMs).toBe(500);
  });

  it("rejects a config with initialDifficulty outside [min, max]", () => {
    expect(() => engine({ initialDifficulty: 99 })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { NBackTask, GRID_SIZE } from "./n-back";

function queueRandom(values: number[]): () => number {
  const queue = [...values];
  return () => {
    if (queue.length === 0) {
      throw new Error("queueRandom exhausted — test crafted the wrong call count");
    }
    return queue.shift()!;
  };
}

describe("NBackTask — warm-up trials", () => {
  it("marks the first N stimuli as not scoreable, and later ones as scoreable", () => {
    const task = new NBackTask({ initialDifficulty: 2, minDifficulty: 2, maxDifficulty: 2 });
    const scoreable = [0, 1, 2, 3].map(() => task.nextStimulus().isScoreable);
    expect(scoreable).toEqual([false, false, true, true]);
  });

  it("does not score a response to a non-scoreable stimulus, and doesn't affect performance stats", () => {
    const task = new NBackTask({ initialDifficulty: 3, minDifficulty: 3, maxDifficulty: 3 });
    task.nextStimulus(); // trial 0, N=3, not scoreable
    const outcome = task.recordResponse(false, { timestamp: 1 });
    expect(outcome).toEqual({ scored: false });
    expect(task.calculatePerformance().trialCount).toBe(0);
  });

  it("throws if recordResponse is called before any nextStimulus", () => {
    const task = new NBackTask();
    expect(() => task.recordResponse(false, { timestamp: 1 })).toThrow();
  });
});

describe("NBackTask — signal detection classification", () => {
  it("classifies hit / miss / falseAlarm / correctRejection correctly", () => {
    // N=2 throughout (min=max=2, so the adaptive engine never moves it,
    // keeping the target-history math predictable for this test).
    const random = queueRandom([
      0.35, // trial0 (idx0, warm-up): position = floor(0.35*9) = 3
      0.6, //  trial1 (idx1, warm-up): position = floor(0.6*9)  = 5
      0.5, //  trial2 (idx2, scoreable): match-check 0.5 >= 0.3 -> not forced
      0.8, //  trial2 position: floor(0.8*9) = 7 (target=history[0]=3 -> mismatch)
      0.1, //  trial3 (idx3, scoreable): match-check 0.1 < 0.3 -> forced match -> position=history[1]=5
      0.05, // trial4 (idx4, scoreable): match-check 0.05 < 0.3 -> forced match -> position=history[2]=7
      0.5, //  trial5 (idx5, scoreable): match-check 0.5 >= 0.3 -> not forced
      0.25, // trial5 position: floor(0.25*9) = 2 (target=history[3]=5 -> mismatch)
    ]);
    const task = new NBackTask({
      initialDifficulty: 2,
      minDifficulty: 2,
      maxDifficulty: 2,
      random,
    });

    task.nextStimulus(); // idx0, warm-up
    task.nextStimulus(); // idx1, warm-up

    task.nextStimulus(); // idx2, mismatch (position 7 vs target 3)
    expect(task.recordResponse(true, { timestamp: 1 })).toMatchObject({
      scored: true,
      classification: "falseAlarm",
      correct: false,
    });

    task.nextStimulus(); // idx3, match (position 5 == target 5)
    expect(task.recordResponse(false, { timestamp: 2 })).toMatchObject({
      scored: true,
      classification: "miss",
      correct: false,
    });

    task.nextStimulus(); // idx4, match (position 7 == target 7)
    expect(task.recordResponse(true, { timestamp: 3 })).toMatchObject({
      scored: true,
      classification: "hit",
      correct: true,
    });

    task.nextStimulus(); // idx5, mismatch (position 2 vs target 5)
    expect(task.recordResponse(false, { timestamp: 4 })).toMatchObject({
      scored: true,
      classification: "correctRejection",
      correct: true,
    });

    expect(task.getSignalDetectionCounts()).toEqual({
      hits: 1,
      misses: 1,
      falseAlarms: 1,
      correctRejections: 1,
    });
    expect(task.calculatePerformance().trialCount).toBe(4);
    expect(task.calculatePerformance().accuracy).toBeCloseTo(0.5);
  });
});

describe("NBackTask — difficulty only moves through the rolling-window engine", () => {
  it("does not change N after a single trial, even a wrong one", () => {
    const task = new NBackTask({ initialDifficulty: 2, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    task.nextStimulus();
    task.nextStimulus();
    const stim = task.nextStimulus(); // forced match (random always 0 < matchProbability)
    expect(stim.isScoreable).toBe(true);
    const outcome = task.recordResponse(false, { timestamp: 1 }); // miss
    expect(outcome).toMatchObject({ scored: true, classification: "miss" });
    if (outcome.scored) {
      expect(outcome.updatedDifficulty).toBe(2); // unchanged — window (8) not full yet
    }
    expect(task.getCurrentN()).toBe(2);
  });

  it("steps difficulty down by exactly one after a full window of misses", () => {
    const task = new NBackTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    // Three warm-up trials (N=3), then 8 scoreable trials, all missed
    // (random always forces a match, respond "no match" every time).
    for (let i = 0; i < 3; i++) task.nextStimulus();
    for (let i = 0; i < 8; i++) {
      task.nextStimulus();
      task.recordResponse(false, { timestamp: i });
    }
    expect(task.getCurrentN()).toBe(2);
  });
});

describe("NBackTask — sequence generation produces a controlled match rate", () => {
  it("approaches the expected match rate (forced + incidental) over many trials", () => {
    const matchProbability = 0.3;
    const task = new NBackTask({
      initialDifficulty: 1,
      minDifficulty: 1,
      maxDifficulty: 1,
      matchProbability,
    });

    const total = 4000;
    let matches = 0;
    let scored = 0;
    let previousPosition: number | null = null;

    for (let i = 0; i < total; i++) {
      const stim = task.nextStimulus();
      if (stim.isScoreable) {
        scored++;
        if (previousPosition !== null && stim.position === previousPosition) {
          matches++;
        }
        task.recordResponse(stim.position === previousPosition, { timestamp: i });
      }
      previousPosition = stim.position;
    }

    const observedRate = matches / scored;
    // Expected: forced matches (matchProbability) plus incidental matches
    // on the remaining draws (1/GRID_SIZE chance each).
    const expectedRate = matchProbability + (1 - matchProbability) * (1 / GRID_SIZE);
    expect(observedRate).toBeGreaterThan(expectedRate - 0.05);
    expect(observedRate).toBeLessThan(expectedRate + 0.05);
  });

  it("never produces a position outside the grid", () => {
    const task = new NBackTask({ initialDifficulty: 2, minDifficulty: 2, maxDifficulty: 2 });
    for (let i = 0; i < 500; i++) {
      const { position } = task.nextStimulus();
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThan(GRID_SIZE);
    }
  });
});

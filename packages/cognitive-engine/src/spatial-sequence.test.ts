import { describe, expect, it } from "vitest";
import { SpatialSequenceTask, SPATIAL_GRID_SIZE } from "./spatial-sequence";

describe("SpatialSequenceTask — configurable grid size (free customization, see apps/web/src/lib/exercise-preferences.ts)", () => {
  it("defaults to the standard 3x3 (9-cell) grid when gridSize is omitted, and reports it via getGridSize", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 4, minDifficulty: 4, maxDifficulty: 4 });
    expect(task.getGridSize()).toBe(9);
  });

  it("never produces a position outside a configured 5x5 (25-cell) grid, and can hold a sequence longer than 9", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 12, minDifficulty: 12, maxDifficulty: 12, gridSize: 25 });
    expect(task.getGridSize()).toBe(25);
    task.startSequence();
    for (let i = 0; i < 12; i++) {
      const position = task.nextSequenceItem();
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThan(25);
    }
    expect(task.isSequenceComplete()).toBe(true);
  });

  it("defaults maxDifficulty to the configured gridSize when not explicitly overridden, so a bigger grid genuinely raises the ceiling", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 9, gridSize: 16, random: () => 0 });
    for (let s = 0; s < 8; s++) {
      task.startSequence();
      const sequence = Array.from({ length: task.getCurrentDifficulty() }, () => task.nextSequenceItem());
      task.submitRecall(sequence, { timestamp: s });
    }
    // 8 fully-correct sequences (a full rolling window) steps difficulty up by exactly one, past the old fixed 9-cap.
    expect(task.getCurrentDifficulty()).toBe(10);
  });
});

describe("SpatialSequenceTask — sequence lifecycle", () => {
  it("throws if nextSequenceItem is called before startSequence", () => {
    const task = new SpatialSequenceTask();
    expect(() => task.nextSequenceItem()).toThrow();
  });

  it("throws if submitRecall is called before startSequence", () => {
    const task = new SpatialSequenceTask();
    expect(() => task.submitRecall([], { timestamp: 1 })).toThrow();
  });

  it("is not complete until sequenceLength items have been shown, then throws on further items", () => {
    const task = new SpatialSequenceTask({
      initialDifficulty: 3,
      minDifficulty: 3,
      maxDifficulty: 3,
      random: () => 0,
    });
    task.startSequence();
    expect(task.isSequenceComplete()).toBe(false);
    task.nextSequenceItem();
    task.nextSequenceItem();
    expect(task.isSequenceComplete()).toBe(false);
    task.nextSequenceItem();
    expect(task.isSequenceComplete()).toBe(true);
    expect(() => task.nextSequenceItem()).toThrow();
  });

  it("never repeats a position within one sequence (deterministic pool-order pick with random always 0)", () => {
    const task = new SpatialSequenceTask({
      initialDifficulty: 5,
      minDifficulty: 5,
      maxDifficulty: 5,
      random: () => 0,
    });
    task.startSequence();
    const sequence = Array.from({ length: 5 }, () => task.nextSequenceItem());
    expect(sequence).toEqual([0, 1, 2, 3, 4]); // first 5 unused grid positions, in order
    expect(new Set(sequence).size).toBe(5);
  });

  it("never produces a position outside the grid", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 9, minDifficulty: 9, maxDifficulty: 9 });
    task.startSequence();
    for (let i = 0; i < SPATIAL_GRID_SIZE; i++) {
      const position = task.nextSequenceItem();
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThan(SPATIAL_GRID_SIZE);
    }
  });
});

describe("SpatialSequenceTask — recall scoring", () => {
  it("scores a fully correct recall and records it as correct on the adaptive engine", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSequence();
    const sequence = [task.nextSequenceItem(), task.nextSequenceItem(), task.nextSequenceItem()];
    const outcome = task.submitRecall(sequence, { timestamp: 1 });
    expect(outcome).toMatchObject({ sequenceLength: 3, correctPositions: 3, fullyCorrect: true });
    expect(task.calculatePerformance().trialCount).toBe(1);
    expect(task.calculatePerformance().accuracy).toBe(1);
  });

  it("scores a reordered recall as partially correct and not fully correct", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSequence();
    task.nextSequenceItem(); // 0
    task.nextSequenceItem(); // 1
    task.nextSequenceItem(); // 2
    const outcome = task.submitRecall([0, 2, 1], { timestamp: 1 });
    expect(outcome.correctPositions).toBe(1); // only position 0 ("0") matches
    expect(outcome.fullyCorrect).toBe(false);
  });

  it("scores a too-short recall as partially correct and not fully correct", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSequence();
    task.nextSequenceItem(); // 0
    task.nextSequenceItem(); // 1
    task.nextSequenceItem(); // 2
    const outcome = task.submitRecall([0, 1], { timestamp: 1 });
    expect(outcome.correctPositions).toBe(2);
    expect(outcome.fullyCorrect).toBe(false);
  });

  it("resets sequence state after submitRecall, ready for a new startSequence", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 2, minDifficulty: 2, maxDifficulty: 2, random: () => 0 });
    task.startSequence();
    task.nextSequenceItem();
    task.nextSequenceItem();
    task.submitRecall([0, 1], { timestamp: 1 });
    expect(() => task.nextSequenceItem()).toThrow(); // no active sequence until startSequence() again
    task.startSequence();
    expect(task.isSequenceComplete()).toBe(false);
    expect(task.nextSequenceItem()).toBe(0); // fresh sequence, pool order resets
  });
});

describe("SpatialSequenceTask — difficulty only moves through the rolling-window engine", () => {
  it("does not change sequence length after a single failed sequence", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    task.startSequence();
    task.nextSequenceItem();
    task.nextSequenceItem();
    task.nextSequenceItem();
    const outcome = task.submitRecall([], { timestamp: 1 }); // guaranteed wrong
    expect(outcome.fullyCorrect).toBe(false);
    expect(outcome.updatedDifficulty).toBe(3); // window (8) not full yet
    expect(task.getCurrentSequenceLength()).toBe(3);
  });

  it("steps sequence length down by exactly one after a full window of failed sequences", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      task.startSequence();
      for (let j = 0; j < task.getCurrentSequenceLength(); j++) task.nextSequenceItem();
      task.submitRecall([], { timestamp: i }); // guaranteed wrong every time
    }
    expect(task.getCurrentSequenceLength()).toBe(2);
  });

  it("steps sequence length up by exactly one after a full window of perfect sequences", () => {
    const task = new SpatialSequenceTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      task.startSequence();
      const sequence = Array.from({ length: task.getCurrentSequenceLength() }, () => task.nextSequenceItem());
      task.submitRecall(sequence, { timestamp: i });
    }
    expect(task.getCurrentSequenceLength()).toBe(4);
  });
});

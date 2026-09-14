import { describe, expect, it } from "vitest";
import { PacedReadingTask } from "./paced-reading-task";
import { READING_PASSAGES } from "./passages";

describe("PacedReadingTask — passage cycling", () => {
  it("throws if recordPassageResult is called before any nextPassage", () => {
    const task = new PacedReadingTask();
    expect(() =>
      task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 1000, timestamp: 1 })
    ).toThrow();
  });

  it("does not repeat a passage until every passage in the pool has been used once", () => {
    const task = new PacedReadingTask({ random: () => 0 });
    const seen = new Set<string>();
    for (let i = 0; i < READING_PASSAGES.length; i++) {
      const p = task.nextPassage();
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
      task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 30_000, timestamp: i });
    }
    expect(seen.size).toBe(READING_PASSAGES.length);
  });

  it("starts a fresh cycle (repeats allowed again) once the pool is exhausted", () => {
    const task = new PacedReadingTask({ random: () => 0 });
    for (let i = 0; i < READING_PASSAGES.length; i++) {
      const p = task.nextPassage();
      task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 30_000, timestamp: i });
      if (i === 0) {
        // random always 0 -> first passage of the pool, deterministically.
        expect(p.id).toBe(READING_PASSAGES[0].id);
      }
    }
    const nextCycleFirst = task.nextPassage();
    expect(nextCycleFirst.id).toBe(READING_PASSAGES[0].id); // fresh cycle, pool order resets
  });
});

describe("PacedReadingTask — scoring", () => {
  it("computes actual WPM from the passage's real word count and elapsed time", () => {
    const task = new PacedReadingTask({ random: () => 0 });
    const passage = task.nextPassage();
    const elapsedMs = 30_000; // 30 seconds
    const outcome = task.recordPassageResult({ answeredCorrectly: true, elapsedMs, timestamp: 1 });
    const expectedWpm = (passage.wordCount / elapsedMs) * 60_000;
    expect(outcome.actualWpm).toBeCloseTo(expectedWpm);
    expect(outcome.correct).toBe(true);
  });

  it("tallies comprehension accuracy across passages", () => {
    const task = new PacedReadingTask({ random: () => 0 });
    task.nextPassage();
    task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 20_000, timestamp: 1 });
    task.nextPassage();
    task.recordPassageResult({ answeredCorrectly: false, elapsedMs: 20_000, timestamp: 2 });
    expect(task.getComprehensionAccuracy()).toEqual({ correct: 1, total: 2 });
  });

  it("reports the mean of recorded WPM samples, and 0 before any", () => {
    const task = new PacedReadingTask({ random: () => 0 });
    expect(task.getAverageWpm()).toBe(0);
    task.nextPassage();
    const o1 = task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 20_000, timestamp: 1 });
    task.nextPassage();
    const o2 = task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 40_000, timestamp: 2 });
    expect(task.getAverageWpm()).toBeCloseTo((o1.actualWpm + o2.actualWpm) / 2);
  });
});

describe("PacedReadingTask — target WPM only moves through the rolling-window engine", () => {
  it("does not change target WPM after a single wrong answer", () => {
    const task = new PacedReadingTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    const startingWpm = task.getCurrentTargetWpm();
    task.nextPassage();
    const outcome = task.recordPassageResult({ answeredCorrectly: false, elapsedMs: 20_000, timestamp: 1 });
    expect(outcome.updatedDifficulty).toBe(3); // window (5) not full yet
    expect(task.getCurrentTargetWpm()).toBe(startingWpm);
  });

  it("steps target WPM down after a full window of wrong comprehension answers", () => {
    const task = new PacedReadingTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    const startingDifficulty = task.getCurrentDifficulty();
    for (let i = 0; i < 5; i++) {
      task.nextPassage();
      task.recordPassageResult({ answeredCorrectly: false, elapsedMs: 20_000, timestamp: i });
    }
    expect(task.getCurrentDifficulty()).toBe(startingDifficulty - 1);
  });

  it("steps target WPM up after a full window of correct comprehension answers", () => {
    const task = new PacedReadingTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    const startingDifficulty = task.getCurrentDifficulty();
    for (let i = 0; i < 5; i++) {
      task.nextPassage();
      task.recordPassageResult({ answeredCorrectly: true, elapsedMs: 20_000, timestamp: i });
    }
    expect(task.getCurrentDifficulty()).toBe(startingDifficulty + 1);
  });
});

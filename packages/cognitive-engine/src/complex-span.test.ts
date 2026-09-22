import { describe, expect, it } from "vitest";
import { ComplexSpanTask } from "./complex-span";

function queueRandom(values: number[]): () => number {
  const queue = [...values];
  return () => {
    if (queue.length === 0) {
      throw new Error("queueRandom exhausted — test crafted the wrong call count");
    }
    return queue.shift()!;
  };
}

describe("ComplexSpanTask — set lifecycle", () => {
  it("throws if nextMemoryItem is called before startSet", () => {
    const task = new ComplexSpanTask();
    expect(() => task.nextMemoryItem()).toThrow();
  });

  it("throws if submitRecall is called before startSet", () => {
    const task = new ComplexSpanTask();
    expect(() => task.submitRecall([], { timestamp: 1 })).toThrow();
  });

  it("is not complete until setSize memory items have been shown, then throws on further items", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 3, maxDifficulty: 3, random: () => 0 });
    task.startSet();
    expect(task.isSetComplete()).toBe(false);
    task.nextMemoryItem();
    task.nextMemoryItem();
    expect(task.isSetComplete()).toBe(false);
    task.nextMemoryItem();
    expect(task.isSetComplete()).toBe(true);
    expect(() => task.nextMemoryItem()).toThrow();
  });

  it("never repeats a letter within one set (deterministic pool-order pick with random always 0)", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 5, minDifficulty: 5, maxDifficulty: 5, random: () => 0 });
    task.startSet();
    const sequence = Array.from({ length: 5 }, () => task.nextMemoryItem());
    expect(sequence).toEqual(["B", "C", "D", "F", "G"]); // first 5 of the consonant pool, in order
    expect(new Set(sequence).size).toBe(5);
  });
});

describe("ComplexSpanTask — recall scoring", () => {
  it("scores a fully correct recall and records it as correct on the adaptive engine", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSet();
    const sequence = [task.nextMemoryItem(), task.nextMemoryItem(), task.nextMemoryItem()];
    const outcome = task.submitRecall(sequence, { timestamp: 1 });
    expect(outcome).toMatchObject({ setSize: 3, correctPositions: 3, fullyCorrect: true });
    expect(task.calculatePerformance().trialCount).toBe(1);
    expect(task.calculatePerformance().accuracy).toBe(1);
  });

  it("scores a reordered recall as partially correct and not fully correct", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSet();
    task.nextMemoryItem(); // B
    task.nextMemoryItem(); // C
    task.nextMemoryItem(); // D
    const outcome = task.submitRecall(["B", "D", "C"], { timestamp: 1 });
    expect(outcome.correctPositions).toBe(1); // only position 0 ("B") matches
    expect(outcome.fullyCorrect).toBe(false);
  });

  it("scores a too-short recall as partially correct and not fully correct", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 9, random: () => 0 });
    task.startSet();
    task.nextMemoryItem(); // B
    task.nextMemoryItem(); // C
    task.nextMemoryItem(); // D
    const outcome = task.submitRecall(["B", "C"], { timestamp: 1 });
    expect(outcome.correctPositions).toBe(2);
    expect(outcome.fullyCorrect).toBe(false);
  });

  it("resets set state after submitRecall, ready for a new startSet", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 2, minDifficulty: 2, maxDifficulty: 2, random: () => 0 });
    task.startSet();
    task.nextMemoryItem();
    task.nextMemoryItem();
    task.submitRecall(["B", "C"], { timestamp: 1 });
    expect(() => task.nextMemoryItem()).toThrow(); // no active set until startSet() again
    task.startSet();
    expect(task.isSetComplete()).toBe(false);
    expect(task.nextMemoryItem()).toBe("B"); // fresh sequence, pool order resets
  });
});

describe("ComplexSpanTask — processing (arithmetic) items", () => {
  it("generates a true item and scores a correct 'true' response", () => {
    const random = queueRandom([
      0.1, // operator '+' (0.1 < 0.5)
      0.5, // a = floor(0.5*9)+1 = 5
      0.2, // b = floor(0.2*9)+1 = 2
      0.1, // showCorrect = true (0.1 < 0.5)
    ]);
    const task = new ComplexSpanTask({ random });
    const item = task.nextProcessingItem();
    expect(item).toMatchObject({ a: 5, b: 2, operator: "+", displayedResult: 7, isCorrect: true });
    expect(task.recordProcessingResponse(true, item)).toBe(true);
    expect(task.getProcessingAccuracy()).toEqual({ correct: 1, total: 1 });
  });

  it("generates a false item and scores a correct 'false' response", () => {
    const random = queueRandom([
      0.1, // operator '+'
      0.5, // a = 5
      0.2, // b = 2
      0.9, // showCorrect = false
      0.4, // perturbation = floor(0.4*2)+1 = 1
      0.3, // negative sign (0.3 < 0.5)
    ]);
    const task = new ComplexSpanTask({ random });
    const item = task.nextProcessingItem();
    expect(item).toMatchObject({ a: 5, b: 2, operator: "+", displayedResult: 6, isCorrect: false });
    expect(task.recordProcessingResponse(false, item)).toBe(true);
    expect(task.recordProcessingResponse(true, item)).toBe(false); // wrong answer, tallied separately
    expect(task.getProcessingAccuracy()).toEqual({ correct: 1, total: 2 });
  });

  it("never produces a negative subtraction operand order (swaps a and b if needed)", () => {
    const random = queueRandom([
      0.6, // operator '-' (0.6 >= 0.5)
      0.1, // a = floor(0.1*9)+1 = 1
      0.8, // b = floor(0.8*9)+1 = 8 (b > a, should swap)
      0.2, // showCorrect = true
    ]);
    const task = new ComplexSpanTask({ random });
    const item = task.nextProcessingItem();
    expect(item.operator).toBe("-");
    expect(item.a).toBeGreaterThanOrEqual(item.b);
    expect(item.a - item.b).toBeGreaterThanOrEqual(0);
    expect(item.displayedResult).toBe(item.a - item.b);
    expect(item.isCorrect).toBe(true);
  });
});

describe("ComplexSpanTask — difficulty only moves through the rolling-window engine", () => {
  it("does not change set size after a single failed set", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    task.startSet();
    task.nextMemoryItem();
    task.nextMemoryItem();
    task.nextMemoryItem();
    const outcome = task.submitRecall([], { timestamp: 1 }); // guaranteed wrong
    expect(outcome.fullyCorrect).toBe(false);
    expect(outcome.updatedDifficulty).toBe(3); // window (8) not full yet
    expect(task.getCurrentSetSize()).toBe(3);
  });

  it("steps set size down by exactly one after a full window of failed sets", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      task.startSet();
      for (let j = 0; j < task.getCurrentSetSize(); j++) task.nextMemoryItem();
      task.submitRecall([], { timestamp: i }); // guaranteed wrong every time
    }
    expect(task.getCurrentSetSize()).toBe(2);
  });

  it("steps set size up by exactly one after a full window of perfect sets", () => {
    const task = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      task.startSet();
      const sequence = Array.from({ length: task.getCurrentSetSize() }, () => task.nextMemoryItem());
      task.submitRecall(sequence, { timestamp: i });
    }
    expect(task.getCurrentSetSize()).toBe(4);
  });
});

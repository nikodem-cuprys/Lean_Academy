import { describe, expect, it } from "vitest";
import { DiceSumTask, DICE_FACE_MIN, DICE_FACE_MAX } from "./dice-sum";

function queueRandom(values: number[]): () => number {
  const queue = [...values];
  return () => {
    if (queue.length === 0) {
      throw new Error("queueRandom exhausted — test crafted the wrong call count");
    }
    return queue.shift()!;
  };
}

describe("DiceSumTask — round lifecycle", () => {
  it("throws if submitAnswer is called before startRound", () => {
    const task = new DiceSumTask();
    expect(() => task.submitAnswer(0, { timestamp: 1 })).toThrow();
  });

  it("rolls exactly diceCount dice, each within the 1-6 face range", () => {
    const task = new DiceSumTask({ initialDifficulty: 6, minDifficulty: 6, maxDifficulty: 6 });
    for (let i = 0; i < 20; i++) {
      const dice = task.startRound();
      expect(dice.length).toBe(6);
      for (const face of dice) {
        expect(face).toBeGreaterThanOrEqual(DICE_FACE_MIN);
        expect(face).toBeLessThanOrEqual(DICE_FACE_MAX);
      }
      task.submitAnswer(dice.reduce((a, b) => a + b, 0), { timestamp: i });
    }
  });

  it("rolls the exact faces the injected random sequence implies", () => {
    // r/6 -> floor(r*6) = k, so face = k+1; these six values roll 1..6 in order.
    const task = new DiceSumTask({
      initialDifficulty: 6,
      minDifficulty: 6,
      maxDifficulty: 6,
      random: queueRandom([0, 0.2, 0.34, 0.5, 0.67, 0.84]),
    });
    expect(task.startRound()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("defaults to a 6-sided die when dieSides is omitted, and reports it via getDieSides", () => {
    const task = new DiceSumTask({ initialDifficulty: 4, minDifficulty: 4, maxDifficulty: 4 });
    expect(task.getDieSides()).toBe(6);
  });

  it("rolls within 1-dieSides when a non-default dieSides is configured (free customization, see apps/web/src/lib/exercise-preferences.ts)", () => {
    const task = new DiceSumTask({ initialDifficulty: 5, minDifficulty: 5, maxDifficulty: 5, dieSides: 20 });
    expect(task.getDieSides()).toBe(20);
    for (let i = 0; i < 20; i++) {
      const dice = task.startRound();
      expect(dice.length).toBe(5);
      for (const face of dice) {
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(20);
      }
      task.submitAnswer(dice.reduce((a, b) => a + b, 0), { timestamp: i });
    }
  });

  it("rolls the max face of a configured dieSides when random() returns just under 1", () => {
    const task = new DiceSumTask({ initialDifficulty: 1, minDifficulty: 1, maxDifficulty: 1, dieSides: 4, random: () => 0.9999 });
    expect(task.startRound()).toEqual([4]);
  });
});

describe("DiceSumTask — scoring", () => {
  it("scores a correct sum as correct and records it on the adaptive engine", () => {
    const task = new DiceSumTask({
      initialDifficulty: 3,
      minDifficulty: 1,
      maxDifficulty: 8,
      random: queueRandom([0, 0.2, 0.34]), // faces 1, 2, 3 -> sum 6
    });
    const dice = task.startRound();
    const outcome = task.submitAnswer(6, { timestamp: 1 });
    expect(outcome).toMatchObject({ diceCount: 3, correctSum: 6, userSum: 6, correct: true });
    expect(dice).toEqual([1, 2, 3]);
    expect(task.calculatePerformance().trialCount).toBe(1);
    expect(task.calculatePerformance().accuracy).toBe(1);
  });

  it("scores a wrong sum as incorrect without throwing", () => {
    const task = new DiceSumTask({
      initialDifficulty: 3,
      minDifficulty: 1,
      maxDifficulty: 8,
      random: queueRandom([0, 0.2, 0.34]), // faces 1, 2, 3 -> sum 6
    });
    task.startRound();
    const outcome = task.submitAnswer(7, { timestamp: 1 });
    expect(outcome).toMatchObject({ correctSum: 6, userSum: 7, correct: false });
  });

  it("resets round state after submitAnswer, ready for a new startRound", () => {
    const task = new DiceSumTask({ initialDifficulty: 3, minDifficulty: 3, maxDifficulty: 3, random: () => 0 });
    task.startRound();
    task.submitAnswer(3, { timestamp: 1 }); // faces [1,1,1], sum 3
    expect(() => task.submitAnswer(0, { timestamp: 2 })).toThrow(); // no active round until startRound() again
    const dice = task.startRound();
    expect(dice.length).toBe(3); // fresh round rolled
  });
});

describe("DiceSumTask — difficulty only moves through the rolling-window engine", () => {
  it("does not change dice count after a single wrong round", () => {
    const task = new DiceSumTask({ initialDifficulty: 4, minDifficulty: 1, maxDifficulty: 8, random: () => 0 });
    task.startRound(); // faces [1,1,1,1], sum 4
    const outcome = task.submitAnswer(0, { timestamp: 1 }); // guaranteed wrong
    expect(outcome.correct).toBe(false);
    expect(outcome.updatedDifficulty).toBe(4); // window not full yet
    expect(task.getCurrentDiceCount()).toBe(4);
  });

  it("steps dice count down by exactly one after a full window of wrong rounds", () => {
    const task = new DiceSumTask({ initialDifficulty: 4, minDifficulty: 1, maxDifficulty: 8, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      task.startRound();
      task.submitAnswer(-1, { timestamp: i }); // guaranteed wrong every time
    }
    expect(task.getCurrentDiceCount()).toBe(3);
  });

  it("steps dice count up by exactly one after a full window of correct rounds", () => {
    const task = new DiceSumTask({ initialDifficulty: 4, minDifficulty: 1, maxDifficulty: 8, random: () => 0 });
    for (let i = 0; i < 8; i++) {
      const dice = task.startRound();
      task.submitAnswer(
        dice.reduce((a, b) => a + b, 0),
        { timestamp: i }
      );
    }
    expect(task.getCurrentDiceCount()).toBe(5);
  });
});

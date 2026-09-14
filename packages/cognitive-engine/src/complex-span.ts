import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type Difficulty,
  type PerformanceMetrics,
} from "@lean-academy/adaptive-engine";

/**
 * Complex span — the "complex-span-v0" module in
 * data/evidence-registry.json. Alternates a simple arithmetic
 * true/false check with letters to remember, then asks for full
 * serial recall of the letter sequence at the end of the set —
 * matching prototype/ExerciseComplexSpan.dc.html's processing step
 * (the recall UI isn't in that mockup; it's new, since the prototype
 * only showed one representative moment of the task).
 *
 * Difficulty maps directly to set size (how many letters per set),
 * same pattern as NBackTask: this class owns that mapping, the
 * adaptive engine only moves an opaque number.
 */

// Consonants only, to discourage recoding the sequence into a word.
const LETTER_POOL = [
  "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
];

export interface ProcessingItem {
  a: number;
  b: number;
  operator: "+" | "-";
  displayedResult: number;
  isCorrect: boolean;
}

export interface SetRecallOutcome {
  setSize: number;
  correctPositions: number;
  fullyCorrect: boolean;
  updatedDifficulty: Difficulty;
}

export interface ProcessingAccuracy {
  correct: number;
  total: number;
}

export interface ComplexSpanTaskConfig {
  initialDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  maxDifficulty?: Difficulty;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export const COMPLEX_SPAN_MIN_SET_SIZE = 3;
export const COMPLEX_SPAN_MAX_SET_SIZE = 9;
export const COMPLEX_SPAN_DEFAULT_INITIAL_SET_SIZE = 4;

export class ComplexSpanTask {
  private readonly adaptiveEngine: RollingWindowAdaptiveEngine;
  private readonly random: () => number;

  private currentSetSize = 0;
  private currentSequence: string[] = [];
  private setStarted = false;
  private processingTally: ProcessingAccuracy = { correct: 0, total: 0 };

  constructor(config: ComplexSpanTaskConfig = {}) {
    this.random = config.random ?? Math.random;
    this.adaptiveEngine = new RollingWindowAdaptiveEngine({
      initialDifficulty: config.initialDifficulty ?? COMPLEX_SPAN_DEFAULT_INITIAL_SET_SIZE,
      minDifficulty: config.minDifficulty ?? COMPLEX_SPAN_MIN_SET_SIZE,
      maxDifficulty: config.maxDifficulty ?? COMPLEX_SPAN_MAX_SET_SIZE,
      ...DEFAULT_ROLLING_WINDOW_CONFIG,
    });
  }

  getCurrentDifficulty(): Difficulty {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  /** Set size is just the current difficulty for this task — see file header. */
  getCurrentSetSize(): number {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  calculatePerformance(): PerformanceMetrics {
    return this.adaptiveEngine.calculatePerformance();
  }

  getProcessingAccuracy(): ProcessingAccuracy {
    return { ...this.processingTally };
  }

  /** Begins a new set: resets the held sequence and locks in this set's size. */
  startSet(): void {
    this.currentSetSize = this.getCurrentSetSize();
    this.currentSequence = [];
    this.setStarted = true;
  }

  isSetComplete(): boolean {
    return this.setStarted && this.currentSequence.length >= this.currentSetSize;
  }

  /** A fresh arithmetic true/false item — independent of set state. */
  nextProcessingItem(): ProcessingItem {
    const operator: "+" | "-" = this.random() < 0.5 ? "+" : "-";
    let a = 1 + Math.floor(this.random() * 9);
    let b = 1 + Math.floor(this.random() * 9);
    if (operator === "-" && b > a) [a, b] = [b, a]; // keep subtraction non-negative

    const correctResult = operator === "+" ? a + b : a - b;
    const showCorrect = this.random() < 0.5;
    let displayedResult = correctResult;
    if (!showCorrect) {
      const perturbation = 1 + Math.floor(this.random() * 2); // 1 or 2
      const negative = this.random() < 0.5;
      displayedResult = correctResult + (negative ? -perturbation : perturbation);
    }

    return { a, b, operator, displayedResult, isCorrect: displayedResult === correctResult };
  }

  /** Scores a processing response against the item it was shown for. */
  recordProcessingResponse(userSaysTrue: boolean, item: ProcessingItem): boolean {
    const correct = userSaysTrue === item.isCorrect;
    this.processingTally = {
      correct: this.processingTally.correct + (correct ? 1 : 0),
      total: this.processingTally.total + 1,
    };
    return correct;
  }

  /** Appends and returns the next to-be-remembered letter for this set. */
  nextMemoryItem(): string {
    if (!this.setStarted) {
      throw new Error("nextMemoryItem called before startSet()");
    }
    if (this.isSetComplete()) {
      throw new Error("Set is already complete — call submitRecall() first");
    }
    const unused = LETTER_POOL.filter((l) => !this.currentSequence.includes(l));
    const letter = unused[Math.floor(this.random() * unused.length)];
    this.currentSequence.push(letter);
    return letter;
  }

  /**
   * Scores full serial recall of the current set against what was
   * actually shown, records the outcome (fully correct or not) to the
   * adaptive engine as one trial, and resets for the next set.
   *
   * @param meta.timestamp performance.now()-based timestamp supplied by
   *   the caller — this class does no timing of its own, same as
   *   NBackTask.recordResponse.
   */
  submitRecall(userSequence: string[], meta: { timestamp: number }): SetRecallOutcome {
    if (!this.setStarted) {
      throw new Error("submitRecall called before startSet()");
    }
    const actual = this.currentSequence;
    const correctPositions = actual.filter((letter, i) => userSequence[i] === letter).length;
    const fullyCorrect = userSequence.length === actual.length && correctPositions === actual.length;

    this.adaptiveEngine.recordTrial({ correct: fullyCorrect, timestamp: meta.timestamp });
    const updatedDifficulty = this.adaptiveEngine.recommendNextDifficulty();

    const setSize = this.currentSetSize;
    this.setStarted = false;
    this.currentSequence = [];

    return { setSize, correctPositions, fullyCorrect, updatedDifficulty };
  }
}

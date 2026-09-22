import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type Difficulty,
  type PerformanceMetrics,
} from "@lean-academy/adaptive-engine";

/**
 * Spatial sequence recall (Corsi-inspired) — the
 * "visuospatial-sequence-recall-v0" module in data/evidence-registry.json.
 * Positions are indices into a grid, defaulting to the 3x3 (0-8) that
 * matches prototype/ExerciseSpatial.dc.html — real, opt-in 4x4/5x5
 * variants are also supported (see SPATIAL_GRID_SIZE_OPTIONS). Cells
 * light up one at a time in a sequence; the player then taps them back
 * in the same order.
 *
 * Unlike ComplexSpanTask, this is simple (not complex) span — no
 * secondary processing task, matching how docs/evidence-review.md
 * describes the Corsi paradigm. Difficulty maps directly to sequence
 * length, same pattern as NBackTask/ComplexSpanTask: this class owns
 * that mapping, the adaptive engine only moves an opaque number.
 */

export const SPATIAL_GRID_SIZE = 9;

/** Free, opt-in customization (see apps/web/src/lib/exercise-preferences.ts) — 3x3 (the default, matching prototype/ExerciseSpatial.dc.html), 4x4, and 5x5 real Corsi-block-test grid sizes. A bigger grid also raises how far difficulty can climb — see maxDifficulty's default below — since a 3x3 grid structurally cannot hold a sequence longer than its own 9 cells. */
export const SPATIAL_GRID_SIZE_OPTIONS = [9, 16, 25] as const;
export type SpatialGridSize = (typeof SPATIAL_GRID_SIZE_OPTIONS)[number];

export interface SequenceRecallOutcome {
  sequenceLength: number;
  correctPositions: number;
  fullyCorrect: boolean;
  updatedDifficulty: Difficulty;
}

export interface SpatialSequenceTaskConfig {
  initialDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  maxDifficulty?: Difficulty;
  /** Sides of the grid, in total cells — defaults to the standard 9 (3x3). See SPATIAL_GRID_SIZE_OPTIONS. */
  gridSize?: SpatialGridSize;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export const SPATIAL_SEQUENCE_MIN_LENGTH = 3;
export const SPATIAL_SEQUENCE_MAX_LENGTH = 9;
export const SPATIAL_SEQUENCE_DEFAULT_INITIAL_LENGTH = 4;

export class SpatialSequenceTask {
  private readonly adaptiveEngine: RollingWindowAdaptiveEngine;
  private readonly random: () => number;
  private readonly gridSize: number;

  private currentLength = 0;
  private currentSequence: number[] = [];
  private sequenceStarted = false;

  constructor(config: SpatialSequenceTaskConfig = {}) {
    this.random = config.random ?? Math.random;
    this.gridSize = config.gridSize ?? SPATIAL_GRID_SIZE;
    this.adaptiveEngine = new RollingWindowAdaptiveEngine({
      initialDifficulty: config.initialDifficulty ?? SPATIAL_SEQUENCE_DEFAULT_INITIAL_LENGTH,
      minDifficulty: config.minDifficulty ?? SPATIAL_SEQUENCE_MIN_LENGTH,
      // A configured grid raises the real ceiling with it — a 3x3
      // grid structurally cannot hold a sequence longer than its own 9
      // cells, so a bigger grid should be able to climb further, not
      // stay artificially capped at 9. Only applies when the caller
      // hasn't explicitly set their own maxDifficulty.
      maxDifficulty: config.maxDifficulty ?? config.gridSize ?? SPATIAL_SEQUENCE_MAX_LENGTH,
      ...DEFAULT_ROLLING_WINDOW_CONFIG,
    });
  }

  getCurrentDifficulty(): Difficulty {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  /** Total cells in this task's grid (defaults to 9, a 3x3). */
  getGridSize(): number {
    return this.gridSize;
  }

  /** Sequence length is just the current difficulty for this task — see file header. */
  getCurrentSequenceLength(): number {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  calculatePerformance(): PerformanceMetrics {
    return this.adaptiveEngine.calculatePerformance();
  }

  /** Begins a new sequence: resets the held sequence and locks in this sequence's length. */
  startSequence(): void {
    this.currentLength = this.getCurrentSequenceLength();
    this.currentSequence = [];
    this.sequenceStarted = true;
  }

  isSequenceComplete(): boolean {
    return this.sequenceStarted && this.currentSequence.length >= this.currentLength;
  }

  /** Appends and returns the next grid position to light up in this sequence. */
  nextSequenceItem(): number {
    if (!this.sequenceStarted) {
      throw new Error("nextSequenceItem called before startSequence()");
    }
    if (this.isSequenceComplete()) {
      throw new Error("Sequence is already complete — call submitRecall() first");
    }
    const unused: number[] = [];
    for (let position = 0; position < this.gridSize; position++) {
      if (!this.currentSequence.includes(position)) unused.push(position);
    }
    const position = unused[Math.floor(this.random() * unused.length)];
    this.currentSequence.push(position);
    return position;
  }

  /**
   * Scores full serial recall of the current sequence against what was
   * actually shown, records the outcome (fully correct or not) to the
   * adaptive engine as one trial, and resets for the next sequence.
   *
   * @param meta.timestamp performance.now()-based timestamp supplied by
   *   the caller — this class does no timing of its own, same as
   *   NBackTask.recordResponse / ComplexSpanTask.submitRecall.
   */
  submitRecall(userSequence: number[], meta: { timestamp: number }): SequenceRecallOutcome {
    if (!this.sequenceStarted) {
      throw new Error("submitRecall called before startSequence()");
    }
    const actual = this.currentSequence;
    const correctPositions = actual.filter((position, i) => userSequence[i] === position).length;
    const fullyCorrect =
      userSequence.length === actual.length && correctPositions === actual.length;

    this.adaptiveEngine.recordTrial({ correct: fullyCorrect, timestamp: meta.timestamp });
    const updatedDifficulty = this.adaptiveEngine.recommendNextDifficulty();

    const sequenceLength = this.currentLength;
    this.sequenceStarted = false;
    this.currentSequence = [];

    return { sequenceLength, correctPositions, fullyCorrect, updatedDifficulty };
  }
}

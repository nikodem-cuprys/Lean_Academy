import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type Difficulty,
  type PerformanceMetrics,
} from "@lean-academy/adaptive-engine";

/**
 * Dice Sum — the "dice-sum-v0" module in data/evidence-registry.json.
 * A round shows a fixed number of dice faces (1-6 pips each); the
 * player must hold every value in mind and, once they're hidden,
 * report the total. Difficulty maps directly to dice count (this
 * class owns that mapping, not the generic adaptive engine, same
 * pattern as N-Back's N and Spatial Sequence's sequence length).
 *
 * Structurally distinct from the other working-memory exercises: dice
 * are shown simultaneously (not one at a time, unlike Spatial
 * Sequence), there's no continuous match judgment (unlike N-Back), and
 * the single "processing step" is the same arithmetic operation
 * (addition) every round, applied to everything held in mind at once
 * rather than alternating with recall (unlike Complex Span). See
 * docs/evidence-review.md §15 for why this is scoped as a
 * working-memory maintenance/updating variant, not a math-skill
 * exercise — difficulty adapts dice count, never the arithmetic
 * itself.
 */

export const DICE_FACE_MIN = 1;
export const DICE_FACE_MAX = 6;

/** Free, opt-in customization (see apps/web/src/lib/exercise-preferences.ts) — the standard 6-sided die plus the common tabletop sizes. */
export const DICE_SIDE_OPTIONS = [4, 6, 8, 10, 12, 20] as const;
export type DiceSides = (typeof DICE_SIDE_OPTIONS)[number];

export const DICE_SUM_MIN_COUNT = 3;
export const DICE_SUM_MAX_COUNT = 8;
export const DICE_SUM_DEFAULT_INITIAL_COUNT = 5;

export interface DiceSumRoundOutcome {
  diceCount: number;
  correctSum: number;
  userSum: number;
  correct: boolean;
  updatedDifficulty: Difficulty;
}

export interface DiceSumTaskConfig {
  initialDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  maxDifficulty?: Difficulty;
  /** Sides per die — defaults to the standard 6. See DICE_SIDE_OPTIONS. Difficulty still adapts dice count only, never this. */
  dieSides?: DiceSides;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export class DiceSumTask {
  private readonly adaptiveEngine: RollingWindowAdaptiveEngine;
  private readonly random: () => number;
  private readonly dieSides: number;

  private currentDice: number[] = [];
  private roundStarted = false;

  constructor(config: DiceSumTaskConfig = {}) {
    this.random = config.random ?? Math.random;
    this.dieSides = config.dieSides ?? DICE_FACE_MAX;
    this.adaptiveEngine = new RollingWindowAdaptiveEngine({
      initialDifficulty: config.initialDifficulty ?? DICE_SUM_DEFAULT_INITIAL_COUNT,
      minDifficulty: config.minDifficulty ?? DICE_SUM_MIN_COUNT,
      maxDifficulty: config.maxDifficulty ?? DICE_SUM_MAX_COUNT,
      ...DEFAULT_ROLLING_WINDOW_CONFIG,
    });
  }

  getCurrentDifficulty(): Difficulty {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  /** Dice count is just the current difficulty for this task — see file header. */
  getCurrentDiceCount(): number {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  calculatePerformance(): PerformanceMetrics {
    return this.adaptiveEngine.calculatePerformance();
  }

  /** Sides per die this task is configured for (defaults to 6). */
  getDieSides(): number {
    return this.dieSides;
  }

  /** Rolls this round's dice (each 1-dieSides) and returns them for display. */
  startRound(): number[] {
    const count = this.getCurrentDiceCount();
    this.currentDice = Array.from(
      { length: count },
      () => DICE_FACE_MIN + Math.floor(this.random() * (this.dieSides - DICE_FACE_MIN + 1))
    );
    this.roundStarted = true;
    return [...this.currentDice];
  }

  /**
   * Scores the round against the dice actually rolled, records the
   * outcome to the adaptive engine as one trial, and resets for the
   * next round.
   *
   * @param meta.timestamp performance.now()-based timestamp supplied by
   *   the caller — this class does no timing of its own, same as
   *   NBackTask.recordResponse / SpatialSequenceTask.submitRecall.
   */
  submitAnswer(userSum: number, meta: { timestamp: number }): DiceSumRoundOutcome {
    if (!this.roundStarted) {
      throw new Error("submitAnswer called before startRound()");
    }
    const diceCount = this.currentDice.length;
    const correctSum = this.currentDice.reduce((sum, face) => sum + face, 0);
    const correct = userSum === correctSum;

    this.adaptiveEngine.recordTrial({ correct, timestamp: meta.timestamp });
    const updatedDifficulty = this.adaptiveEngine.recommendNextDifficulty();

    this.roundStarted = false;
    this.currentDice = [];

    return { diceCount, correctSum, userSum, correct, updatedDifficulty };
  }
}

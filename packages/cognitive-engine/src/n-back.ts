import {
  RollingWindowAdaptiveEngine,
  DEFAULT_ROLLING_WINDOW_CONFIG,
  type Difficulty,
  type PerformanceMetrics,
} from "@lean-academy/adaptive-engine";

/**
 * Visual/spatial n-back — the "adaptive-nback-v0" module in
 * data/evidence-registry.json. Positions are indices into a 3x3 grid
 * (0-8), matching prototype/Exercise.dc.html.
 *
 * Difficulty maps directly to N (difficulty 1 = 1-back, up to
 * maxDifficulty = 9-back) — this class owns that mapping, not the
 * generic adaptive engine, per packages/adaptive-engine's design (it
 * only knows how to move an opaque difficulty number, never what it
 * means to a specific task).
 */

export const GRID_SIZE = 9;

export type NBackClassification =
  | "hit"
  | "miss"
  | "falseAlarm"
  | "correctRejection";

export interface NBackStimulus {
  /** 0-8, position on the 3x3 grid. */
  position: number;
  /** Index of this stimulus within the run (0-based). */
  trialIndex: number;
  /**
   * Whether the task can be meaningfully judged yet — false for the
   * first N stimuli of a run, since no n-back history exists for them.
   * The UI should present these as part of the stream but not require
   * (or score) a response.
   */
  isScoreable: boolean;
}

export type NBackResponseOutcome =
  | { scored: false }
  | {
      scored: true;
      classification: NBackClassification;
      correct: boolean;
      updatedDifficulty: Difficulty;
    };

export interface SignalDetectionCounts {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
}

export interface NBackTaskConfig {
  initialDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  maxDifficulty?: Difficulty;
  /** Probability that a given scoreable trial is forced to be a match. */
  matchProbability?: number;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export const NBACK_MIN_DIFFICULTY = 1;
export const NBACK_MAX_DIFFICULTY = 9;
export const NBACK_DEFAULT_INITIAL_DIFFICULTY = 2;
const DEFAULT_MATCH_PROBABILITY = 0.3;

export class NBackTask {
  private readonly adaptiveEngine: RollingWindowAdaptiveEngine;
  private readonly matchProbability: number;
  private readonly random: () => number;

  private history: number[] = [];
  /** The N in effect when each history entry was generated. */
  private nAtIndex: number[] = [];
  private lastStimulus: NBackStimulus | null = null;
  private counts: SignalDetectionCounts = {
    hits: 0,
    misses: 0,
    falseAlarms: 0,
    correctRejections: 0,
  };

  constructor(config: NBackTaskConfig = {}) {
    this.matchProbability = config.matchProbability ?? DEFAULT_MATCH_PROBABILITY;
    this.random = config.random ?? Math.random;

    this.adaptiveEngine = new RollingWindowAdaptiveEngine({
      initialDifficulty: config.initialDifficulty ?? NBACK_DEFAULT_INITIAL_DIFFICULTY,
      minDifficulty: config.minDifficulty ?? NBACK_MIN_DIFFICULTY,
      maxDifficulty: config.maxDifficulty ?? NBACK_MAX_DIFFICULTY,
      ...DEFAULT_ROLLING_WINDOW_CONFIG,
    });
  }

  getCurrentDifficulty(): Difficulty {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  /** N is just the current difficulty for this task — see file header. */
  getCurrentN(): number {
    return this.adaptiveEngine.getCurrentDifficulty();
  }

  calculatePerformance(): PerformanceMetrics {
    return this.adaptiveEngine.calculatePerformance();
  }

  getSignalDetectionCounts(): SignalDetectionCounts {
    return { ...this.counts };
  }

  /**
   * Generates and returns the next stimulus in the run. The N used is
   * captured at generation time, so a difficulty change (which only
   * happens between trials, never mid-trial) takes effect starting with
   * the stimulus it's requested for, not retroactively.
   */
  nextStimulus(): NBackStimulus {
    const n = this.getCurrentN();
    const trialIndex = this.history.length;
    const isScoreable = trialIndex >= n;

    let position: number;
    if (isScoreable && this.random() < this.matchProbability) {
      position = this.history[trialIndex - n];
    } else {
      position = Math.floor(this.random() * GRID_SIZE);
    }

    this.history.push(position);
    this.nAtIndex.push(n);

    const stimulus: NBackStimulus = { position, trialIndex, isScoreable };
    this.lastStimulus = stimulus;
    return stimulus;
  }

  /**
   * Scores the response to the most recently generated stimulus. Must
   * be called at most once per nextStimulus() call.
   *
   * @param meta.timestamp performance.now()-based timestamp of the
   *   response, supplied by the caller — this class does no timing of
   *   its own (see docs/product-requirements.md's timing-integrity
   *   requirement, implemented in the UI layer, not here).
   */
  recordResponse(
    userSaysMatch: boolean,
    meta: { timestamp: number; reactionTimeMs?: number }
  ): NBackResponseOutcome {
    const stimulus = this.lastStimulus;
    if (!stimulus) {
      throw new Error("recordResponse called before any nextStimulus()");
    }
    this.lastStimulus = null;

    if (!stimulus.isScoreable) {
      return { scored: false };
    }

    const n = this.nAtIndex[stimulus.trialIndex];
    const targetPosition = this.history[stimulus.trialIndex - n];
    const isMatch = stimulus.position === targetPosition;

    let classification: NBackClassification;
    if (isMatch && userSaysMatch) classification = "hit";
    else if (isMatch && !userSaysMatch) classification = "miss";
    else if (!isMatch && userSaysMatch) classification = "falseAlarm";
    else classification = "correctRejection";

    const correct = classification === "hit" || classification === "correctRejection";
    this.counts[
      classification === "hit"
        ? "hits"
        : classification === "miss"
          ? "misses"
          : classification === "falseAlarm"
            ? "falseAlarms"
            : "correctRejections"
    ]++;

    this.adaptiveEngine.recordTrial({
      correct,
      reactionTimeMs: meta.reactionTimeMs,
      timestamp: meta.timestamp,
    });
    const updatedDifficulty = this.adaptiveEngine.recommendNextDifficulty();

    return { scored: true, classification, correct, updatedDifficulty };
  }
}

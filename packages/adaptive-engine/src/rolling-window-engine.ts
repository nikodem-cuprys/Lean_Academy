import type {
  AdaptiveTrainingTask,
  Difficulty,
  PerformanceMetrics,
  TrialResult,
} from "./types";

export interface RollingWindowConfig {
  initialDifficulty: Difficulty;
  minDifficulty: Difficulty;
  maxDifficulty: Difficulty;
  /**
   * How many recent trials must accumulate before the engine will even
   * consider changing difficulty. This is the mechanism that rules out
   * "one good answer -> instantly harder" / "one mistake -> instantly
   * easier" (see project_prompt.txt's ADAPTIVE TRAINING ENGINE section).
   */
  windowSize: number;
  /** Accuracy over the window at/above which difficulty steps up. */
  increaseThreshold: number;
  /** Accuracy over the window at/below which difficulty steps down. */
  decreaseThreshold: number;
}

// windowSize was 5 through the project's first several sessions; raised
// to 8 in response to real user feedback that difficulty ramped too
// fast — with every exercise's rounds-per-session at 5 or 20, a
// windowSize of 5 meant even a single strong session (or, for N-Back's
// 20 trials, up to 4 windows within one session) could push difficulty
// up multiple times before the user had much chance to feel settled at
// a level. A wider window requires more sustained evidence before any
// change, up or down, which is the standard way to slow an adaptive
// system's response rate without making it directionally unfair (see
// the alternative considered and rejected in this change's own commit:
// raising increaseThreshold alone, with a 5-trial window, only offers
// fifths as achievable accuracy values, so anything above 0.8 would
// have silently demanded literal 100% — a much harsher, all-or-nothing
// change rather than a genuinely smoother one).
export const DEFAULT_ROLLING_WINDOW_CONFIG: Omit<
  RollingWindowConfig,
  "initialDifficulty" | "minDifficulty" | "maxDifficulty"
> = {
  windowSize: 8,
  increaseThreshold: 0.8,
  decreaseThreshold: 0.5,
};

/**
 * A general-purpose AdaptiveTrainingTask implementation: difficulty moves
 * by at most one step at a time, and only once a full rolling window of
 * trials has accumulated. After a step is taken, the window resets, so
 * the next change also requires a fresh full window — this prevents
 * rapid back-to-back adjustments from a lucky or unlucky streak.
 *
 * Individual exercises (n-back, complex span, dice sum, ...) should wrap
 * this with their own Difficulty -> real task parameters mapping rather
 * than reimplementing the adaptation logic themselves.
 */
export class RollingWindowAdaptiveEngine implements AdaptiveTrainingTask {
  private difficulty: Difficulty;
  private readonly config: RollingWindowConfig;
  private window: TrialResult[] = [];
  private allTrials: TrialResult[] = [];

  constructor(config: RollingWindowConfig) {
    if (config.minDifficulty > config.maxDifficulty) {
      throw new Error("minDifficulty cannot be greater than maxDifficulty");
    }
    if (
      config.initialDifficulty < config.minDifficulty ||
      config.initialDifficulty > config.maxDifficulty
    ) {
      throw new Error("initialDifficulty must be within [min, max]");
    }
    if (config.windowSize < 1) {
      throw new Error("windowSize must be at least 1");
    }
    this.config = config;
    this.difficulty = config.initialDifficulty;
  }

  getCurrentDifficulty(): Difficulty {
    return this.difficulty;
  }

  recordTrial(result: TrialResult): void {
    this.allTrials.push(result);
    this.window.push(result);
    if (this.window.length > this.config.windowSize) {
      this.window.shift();
    }
  }

  calculatePerformance(): PerformanceMetrics {
    return summarize(this.allTrials);
  }

  /**
   * Evaluates the current rolling window and, if it's full, applies at
   * most a one-step difficulty change (clamped to [min, max]) and resets
   * the window. Returns the (possibly updated) current difficulty either
   * way — safe to call after every trial.
   */
  recommendNextDifficulty(): Difficulty {
    if (this.window.length < this.config.windowSize) {
      return this.difficulty;
    }

    const { accuracy } = summarize(this.window);
    const { increaseThreshold, decreaseThreshold, minDifficulty, maxDifficulty } =
      this.config;

    if (accuracy >= increaseThreshold) {
      this.difficulty = Math.min(maxDifficulty, this.difficulty + 1);
      this.window = [];
    } else if (accuracy <= decreaseThreshold) {
      this.difficulty = Math.max(minDifficulty, this.difficulty - 1);
      this.window = [];
    }
    // In the "comfortable middle" band, leave difficulty and the window
    // alone — it keeps sliding until it next crosses a threshold.

    return this.difficulty;
  }
}

function summarize(trials: TrialResult[]): PerformanceMetrics {
  if (trials.length === 0) {
    return { trialCount: 0, accuracy: 0 };
  }
  const correct = trials.filter((t) => t.correct).length;
  const withRt = trials.filter((t) => typeof t.reactionTimeMs === "number");
  const meanReactionTimeMs = withRt.length
    ? withRt.reduce((sum, t) => sum + (t.reactionTimeMs ?? 0), 0) / withRt.length
    : undefined;

  return {
    trialCount: trials.length,
    accuracy: correct / trials.length,
    meanReactionTimeMs,
  };
}

/**
 * A difficulty level is an opaque integer step (e.g. 1 = Beginner-ish,
 * higher = harder). Each exercise maps these to its own real task
 * parameters (n-back's N, span length, dice count, ...) — the adaptive
 * engine never needs to know what a level *means*, only how to move
 * between them. See docs/product-requirements.md's "Intuitive difficulty"
 * requirement: users see Beginner/Intermediate/Advanced/Expert/Custom or
 * Auto, never this raw number.
 */
export type Difficulty = number;

export interface TrialResult {
  correct: boolean;
  /** Reaction time in ms, when the paradigm measures it. */
  reactionTimeMs?: number;
  /** performance.now()-based timestamp of when the trial resolved. */
  timestamp: number;
}

export interface PerformanceMetrics {
  trialCount: number;
  accuracy: number;
  meanReactionTimeMs?: number;
}

/**
 * The shared interface every exercise's difficulty logic implements.
 * See project_prompt.txt's ADAPTIVE TRAINING ENGINE section — this is
 * copied verbatim from the spec.
 */
export interface AdaptiveTrainingTask {
  getCurrentDifficulty(): Difficulty;
  recordTrial(result: TrialResult): void;
  calculatePerformance(): PerformanceMetrics;
  recommendNextDifficulty(): Difficulty;
}

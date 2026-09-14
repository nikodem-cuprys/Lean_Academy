/**
 * Shared shape each exercise component uses when it's run inside a
 * strung-together training session (see TrainingSession/session
 * orchestration in docs/kanban.md's Daily Training epic) instead of
 * standalone via its own /train/<exercise> route. When `onComplete` is
 * passed, a component skips its own internal results screen and hands
 * this back instead, so the session runner can persist real Trial rows
 * and move on to the next exercise without returning to a menu.
 *
 * Each exercise still fully owns what one "trial" means for its own
 * task (one N-back stimulus, one Complex Span set, one Spatial Sequence
 * round, one reading passage) — this is just the common wire shape all
 * four get flattened into for packages/db's Trial model.
 */

export interface TrialInput {
  correct: boolean;
  reactionTimeMs?: number;
  /** Epoch milliseconds — components time internally with performance.now(); see perfToEpochMs. */
  stimulusStartedAtMs: number;
  respondedAtMs?: number;
  wasInterrupted: boolean;
  difficultyAtTrial: number;
  metadata?: Record<string, unknown>;
}

export interface ExerciseSessionOutcome {
  method: string;
  startDifficulty: number;
  endDifficulty: number;
  trials: TrialInput[];
  /** Plain-language "before → after" line for the Session Complete screen, e.g. "Level 4 → 5" or "268 → 281 WPM" — each exercise formats this itself since only it knows what its difficulty number means. */
  summaryLabel: string;
}

export interface SessionModeProps {
  /** Seeds the task's starting difficulty (continuing from a saved DifficultyState) instead of the task's own hardcoded default. */
  initialDifficulty?: number;
  /** When provided, the component runs once, skips its own results screen, and calls this instead of rendering one. */
  onComplete?: (outcome: ExerciseSessionOutcome) => void;
}

/** Offset between performance.now() (monotonic, page-load-relative) and Date.now() (epoch) — compute once per component instance. */
export function epochOffsetMs(): number {
  return Date.now() - performance.now();
}

export function perfToEpochMs(perfMs: number, offsetMs: number): number {
  return Math.round(offsetMs + perfMs);
}

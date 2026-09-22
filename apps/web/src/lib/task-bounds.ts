import {
  NBACK_DEFAULT_INITIAL_DIFFICULTY,
  NBACK_MIN_DIFFICULTY,
  NBACK_MAX_DIFFICULTY,
  COMPLEX_SPAN_DEFAULT_INITIAL_SET_SIZE,
  COMPLEX_SPAN_MIN_SET_SIZE,
  COMPLEX_SPAN_MAX_SET_SIZE,
  SPATIAL_SEQUENCE_DEFAULT_INITIAL_LENGTH,
  SPATIAL_SEQUENCE_MIN_LENGTH,
  SPATIAL_SEQUENCE_MAX_LENGTH,
  DICE_SUM_DEFAULT_INITIAL_COUNT,
  DICE_SUM_MIN_COUNT,
  DICE_SUM_MAX_COUNT,
} from "@lean-academy/cognitive-engine";
import {
  READING_DEFAULT_INITIAL_DIFFICULTY,
  READING_MIN_DIFFICULTY,
  READING_MAX_DIFFICULTY,
} from "@lean-academy/reading-engine";

/**
 * Each implemented exercise's min/max/default internal Difficulty
 * number, keyed by its evidence-registry `method` id — shared by
 * anything that needs to reason about where a user's current
 * difficulty sits on a task's own range (the onboarding
 * recommended-level mapping, the Progress page's per-task progress
 * bars). Never shown to the user directly — see CLAUDE.md's
 * difficulty-display rule.
 */

export interface TaskBounds {
  min: number;
  default: number;
  max: number;
}

export const TASK_BOUNDS: Record<string, TaskBounds> = {
  "adaptive-nback-v0": {
    min: NBACK_MIN_DIFFICULTY,
    default: NBACK_DEFAULT_INITIAL_DIFFICULTY,
    max: NBACK_MAX_DIFFICULTY,
  },
  "complex-span-v0": {
    min: COMPLEX_SPAN_MIN_SET_SIZE,
    default: COMPLEX_SPAN_DEFAULT_INITIAL_SET_SIZE,
    max: COMPLEX_SPAN_MAX_SET_SIZE,
  },
  "visuospatial-sequence-recall-v0": {
    min: SPATIAL_SEQUENCE_MIN_LENGTH,
    default: SPATIAL_SEQUENCE_DEFAULT_INITIAL_LENGTH,
    max: SPATIAL_SEQUENCE_MAX_LENGTH,
  },
  "reading-paced-adaptive-v0": {
    min: READING_MIN_DIFFICULTY,
    default: READING_DEFAULT_INITIAL_DIFFICULTY,
    max: READING_MAX_DIFFICULTY,
  },
  "dice-sum-v0": {
    min: DICE_SUM_MIN_COUNT,
    default: DICE_SUM_DEFAULT_INITIAL_COUNT,
    max: DICE_SUM_MAX_COUNT,
  },
};

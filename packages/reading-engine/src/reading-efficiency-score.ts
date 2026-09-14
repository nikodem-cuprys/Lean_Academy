/**
 * The combined Reading Efficiency Score — see project_prompt.txt's
 * READING EFFICIENCY SCORE section and docs/product-requirements.md's
 * "comprehension floor" requirement. The floor must come from the
 * reading-research literature (docs/evidence-review.md §8), not be
 * chosen arbitrarily.
 *
 * COMPREHENSION_FLOOR = 0.70, taken from Betts' (1946) Informal Reading
 * Inventory criteria for "instructional level": ~95% word-recognition
 * accuracy paired with ~70% comprehension is the long-established
 * threshold in reading-assessment literature below which a reader is
 * considered to be struggling with a text ("frustration level"), rather
 * than an arbitrary product decision. This is a distinct, simpler
 * threshold than the "moderate/severe" WPM-vs-comprehension trade-off
 * discussed in evidence-review.md §8's Klimovich et al. RCT, which
 * establishes the realistic *size* of a WPM gain rather than a specific
 * floor value — the floor itself is sourced from the classic
 * reading-assessment convention instead.
 *
 * The formula: at or above the floor, the score is the standard
 * "effective reading rate" used in reading-rate research — WPM times
 * comprehension accuracy. Below the floor, comprehension accuracy is
 * applied twice (once more as its own ratio to the floor), so the
 * score drops off faster than linear — implementing project_prompt.txt's
 * "never allow extreme speed to compensate entirely for poor
 * comprehension." The two branches agree exactly at the floor, so the
 * score is continuous, not a cliff.
 */

export const COMPREHENSION_FLOOR = 0.7;

export interface ReadingEfficiencyInput {
  /** Mean words-per-minute across the scored passages. */
  averageWpm: number;
  /** Fraction of comprehension questions answered correctly, 0-1. */
  comprehensionAccuracy: number;
}

export function calculateReadingEfficiencyScore({
  averageWpm,
  comprehensionAccuracy,
}: ReadingEfficiencyInput): number {
  if (comprehensionAccuracy >= COMPREHENSION_FLOOR) {
    return averageWpm * comprehensionAccuracy;
  }
  return averageWpm * comprehensionAccuracy * (comprehensionAccuracy / COMPREHENSION_FLOOR);
}

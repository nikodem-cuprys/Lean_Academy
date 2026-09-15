import { inverseNormalCdf } from "./inverse-normal-cdf";

/**
 * Confidence interval for a proportion-based score — accuracy on an
 * assessment, or a span-staircase assessment's percent-correct at its
 * final span level. There is no separate accepted "span confidence
 * interval" formula to use instead: a span score's own uncertainty is
 * itself a proportion-correct-based measure, so this is the one real
 * building block project_prompt.txt's "confidence intervals for Phase 6
 * assessments" needs (see docs/kanban.md's Real psychometric scoring
 * library card). Needed before any AssessmentResult can be shown as
 * anything other than a bare, falsely-precise number: a handful of
 * calibration/assessment trials genuinely doesn't pin down a user's
 * true accuracy to the trial-count's own precision.
 */

export interface ProportionConfidenceInterval {
  proportion: number;
  lower: number;
  upper: number;
  confidenceLevel: number;
}

/**
 * Wilson score interval (Wilson, E.B. (1927). "Probable inference, the
 * law of succession, and statistical inference." Journal of the
 * American Statistical Association, 22(158), 209-212) — the standard
 * recommendation over the simpler normal/Wald interval because it
 * stays within [0,1] and keeps real coverage close to the nominal
 * confidence level even at small sample sizes or extreme proportions,
 * exactly the regime a short assessment battery (a handful of trials,
 * not hundreds) falls into.
 */
export function calculateProportionConfidenceInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): ProportionConfidenceInterval {
  if (total <= 0 || !Number.isInteger(total)) {
    throw new Error(`calculateProportionConfidenceInterval requires a positive integer total, got ${total}.`);
  }
  if (successes < 0 || successes > total || !Number.isInteger(successes)) {
    throw new Error(`calculateProportionConfidenceInterval requires 0 <= successes <= total, got ${successes} of ${total}.`);
  }
  if (!(confidenceLevel > 0 && confidenceLevel < 1)) {
    throw new Error(`calculateProportionConfidenceInterval requires 0 < confidenceLevel < 1, got ${confidenceLevel}.`);
  }

  const p = successes / total;
  const z = inverseNormalCdf(1 - (1 - confidenceLevel) / 2); // two-sided critical value
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total))) / denominator;

  return {
    proportion: p,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    confidenceLevel,
  };
}

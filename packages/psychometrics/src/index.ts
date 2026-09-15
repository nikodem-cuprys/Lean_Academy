/**
 * Accepted psychometric calculations — see "PERFORMANCE METRICS" in
 * project_prompt.txt: "Do not invent pseudoscientific metrics when
 * accepted measures exist." Every function here cites the accepted
 * formula it implements and has dedicated unit tests (docs/testing.md
 * calls out scientific-calculation tests as their own test category).
 *
 * Scoped to the two real gaps docs/kanban.md's Real psychometric
 * scoring library card names — d-prime/hit-rate/false-alarm-rate
 * (signal-detection.ts) and a confidence interval for a proportion/
 * span score (confidence-interval.ts) — not the full eventual set
 * ("switch cost" etc.) that comment in the old placeholder named; those
 * get added when a real card needs them, not speculatively here.
 */

export {
  calculateSignalDetectionRates,
  calculateDPrime,
  type SignalDetectionCounts,
  type SignalDetectionRates,
} from "./signal-detection";

export {
  calculateProportionConfidenceInterval,
  type ProportionConfidenceInterval,
} from "./confidence-interval";

export { inverseNormalCdf } from "./inverse-normal-cdf";

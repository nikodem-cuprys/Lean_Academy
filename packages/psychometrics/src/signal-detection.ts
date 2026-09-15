import { inverseNormalCdf } from "./inverse-normal-cdf";

/**
 * Signal-detection theory scoring — d-prime and hit-rate/false-alarm-
 * rate, the two PERFORMANCE METRICS project_prompt.txt names that
 * apply to go/no-go-style tasks. N-Back's trials already carry a real
 * hit/miss/falseAlarm/correctRejection classification per trial in
 * `Trial.metadata` (see apps/web/src/components/NBackExercise.tsx) —
 * this module scores real data that already exists, not new
 * instrumentation.
 */

export interface SignalDetectionCounts {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
}

export interface SignalDetectionRates {
  hitRate: number;
  falseAlarmRate: number;
}

/**
 * Corrects a rate of exactly 0 or 1 using the standard 1/(2N) rule
 * (Hautus, M.J. (1995). "Corrections for extreme proportions and their
 * biasing effects on estimated values of d'." Behavior Research
 * Methods, Instruments, & Computers, 27(1), 46-51) — without it, a
 * perfect or zero rate sends z() to +/-Infinity, which would make
 * d-prime undefined for exactly the best- and worst-performing real
 * users rather than just the ones in between.
 */
function correctExtremeProportion(rate: number, trialCount: number): number {
  if (rate <= 0) return 0.5 / trialCount;
  if (rate >= 1) return (trialCount - 0.5) / trialCount;
  return rate;
}

/**
 * Hit rate and false-alarm rate from raw signal-detection counts, with
 * the extreme-proportion correction above already applied — this is
 * the value both a d-prime calculation and any real display of "hit
 * rate" should use, not the raw uncorrected proportion.
 */
export function calculateSignalDetectionRates(counts: SignalDetectionCounts): SignalDetectionRates {
  const signalTrials = counts.hits + counts.misses;
  const noiseTrials = counts.falseAlarms + counts.correctRejections;
  if (signalTrials <= 0 || noiseTrials <= 0) {
    throw new Error("calculateSignalDetectionRates requires at least one signal trial (hit/miss) and one noise trial (falseAlarm/correctRejection).");
  }

  return {
    hitRate: correctExtremeProportion(counts.hits / signalTrials, signalTrials),
    falseAlarmRate: correctExtremeProportion(counts.falseAlarms / noiseTrials, noiseTrials),
  };
}

/**
 * d' = z(hit rate) - z(false-alarm rate) — the standard signal-
 * detection-theory sensitivity measure (Green, D.M., & Swets, J.A.
 * (1966). Signal Detection Theory and Psychophysics. Wiley), scored
 * from the same extreme-proportion-corrected rates
 * calculateSignalDetectionRates returns.
 */
export function calculateDPrime(counts: SignalDetectionCounts): number {
  const { hitRate, falseAlarmRate } = calculateSignalDetectionRates(counts);
  return inverseNormalCdf(hitRate) - inverseNormalCdf(falseAlarmRate);
}

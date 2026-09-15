import { describe, it, expect } from "vitest";
import { calculateSignalDetectionRates, calculateDPrime } from "./signal-detection";

describe("calculateSignalDetectionRates", () => {
  it("computes plain hit rate and false-alarm rate when neither is extreme", () => {
    const rates = calculateSignalDetectionRates({ hits: 15, misses: 5, falseAlarms: 5, correctRejections: 15 });
    expect(rates.hitRate).toBeCloseTo(0.75, 10);
    expect(rates.falseAlarmRate).toBeCloseTo(0.25, 10);
  });

  it("applies the 1/(2N) correction to a perfect hit rate instead of leaving it at exactly 1", () => {
    const rates = calculateSignalDetectionRates({ hits: 10, misses: 0, falseAlarms: 3, correctRejections: 7 });
    expect(rates.hitRate).toBeCloseTo(9.5 / 10, 10); // (N - 0.5) / N
  });

  it("applies the 1/(2N) correction to a zero false-alarm rate instead of leaving it at exactly 0", () => {
    const rates = calculateSignalDetectionRates({ hits: 7, misses: 3, falseAlarms: 0, correctRejections: 10 });
    expect(rates.falseAlarmRate).toBeCloseTo(0.5 / 10, 10);
  });

  it("throws when there are no signal trials or no noise trials to score", () => {
    expect(() => calculateSignalDetectionRates({ hits: 0, misses: 0, falseAlarms: 2, correctRejections: 8 })).toThrow();
    expect(() => calculateSignalDetectionRates({ hits: 4, misses: 6, falseAlarms: 0, correctRejections: 0 })).toThrow();
  });
});

describe("calculateDPrime", () => {
  it("matches the textbook worked example (H = 0.75, FA = 0.25 -> d' ~= 1.349)", () => {
    // Stanislaw & Todorov (1999), "Calculation of signal detection
    // theory measures" — the standard reference worked example.
    const dPrime = calculateDPrime({ hits: 75, misses: 25, falseAlarms: 25, correctRejections: 75 });
    expect(dPrime).toBeCloseTo(1.34898, 3);
  });

  it("is 0 when hit rate equals false-alarm rate (no discrimination ability)", () => {
    const dPrime = calculateDPrime({ hits: 30, misses: 70, falseAlarms: 30, correctRejections: 70 });
    expect(dPrime).toBeCloseTo(0, 8);
  });

  it("stays finite for a perfect run instead of returning Infinity", () => {
    const dPrime = calculateDPrime({ hits: 20, misses: 0, falseAlarms: 0, correctRejections: 20 });
    expect(Number.isFinite(dPrime)).toBe(true);
    expect(dPrime).toBeGreaterThan(0);
  });

  it("is higher for a real N-Back-shaped run with more hits/correct-rejections than one with more misses/false-alarms", () => {
    const strongRun = calculateDPrime({ hits: 17, misses: 3, falseAlarms: 2, correctRejections: 18 });
    const weakRun = calculateDPrime({ hits: 11, misses: 9, falseAlarms: 8, correctRejections: 12 });
    expect(strongRun).toBeGreaterThan(weakRun);
  });
});

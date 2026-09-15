import { describe, it, expect } from "vitest";
import { inverseNormalCdf } from "./inverse-normal-cdf";

describe("inverseNormalCdf", () => {
  it("returns 0 at the median (p = 0.5)", () => {
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 6);
  });

  it("matches well-known standard-normal critical values", () => {
    // The values every introductory-statistics table quotes for a
    // two-sided 95%/99% interval.
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 5);
    expect(inverseNormalCdf(0.025)).toBeCloseTo(-1.959964, 5);
    expect(inverseNormalCdf(0.995)).toBeCloseTo(2.575829, 5);
  });

  it("is antisymmetric around p = 0.5", () => {
    expect(inverseNormalCdf(0.9)).toBeCloseTo(-inverseNormalCdf(0.1), 8);
  });

  it("handles the extreme low/high tail branches (p < 0.02425 and p > 0.97575)", () => {
    // These land in Acklam's separate rational-approximation branch for
    // the tails, not the central one — worth its own coverage.
    expect(inverseNormalCdf(0.0001)).toBeCloseTo(-3.719016, 4);
    expect(inverseNormalCdf(0.9999)).toBeCloseTo(3.719016, 4);
  });

  it("rejects p outside the open interval (0, 1)", () => {
    expect(() => inverseNormalCdf(0)).toThrow();
    expect(() => inverseNormalCdf(1)).toThrow();
    expect(() => inverseNormalCdf(-0.1)).toThrow();
    expect(() => inverseNormalCdf(1.1)).toThrow();
  });
});

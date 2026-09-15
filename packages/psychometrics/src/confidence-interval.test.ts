import { describe, it, expect } from "vitest";
import { calculateProportionConfidenceInterval } from "./confidence-interval";

describe("calculateProportionConfidenceInterval", () => {
  it("matches the standard worked example (50/100 at 95% -> Wilson interval ~= [0.404, 0.596])", () => {
    const interval = calculateProportionConfidenceInterval(50, 100, 0.95);
    expect(interval.proportion).toBeCloseTo(0.5, 10);
    expect(interval.lower).toBeCloseTo(0.404, 2);
    expect(interval.upper).toBeCloseTo(0.596, 2);
  });

  it("defaults to a 95% confidence level when none is given", () => {
    const withDefault = calculateProportionConfidenceInterval(50, 100);
    const explicit95 = calculateProportionConfidenceInterval(50, 100, 0.95);
    expect(withDefault).toEqual(explicit95);
  });

  it("stays within [0, 1] and widens correctly for a perfect score", () => {
    const interval = calculateProportionConfidenceInterval(10, 10, 0.95);
    expect(interval.proportion).toBe(1);
    expect(interval.upper).toBe(1);
    expect(interval.lower).toBeGreaterThan(0);
    expect(interval.lower).toBeLessThan(1);
  });

  it("stays within [0, 1] for a zero score", () => {
    const interval = calculateProportionConfidenceInterval(0, 10, 0.95);
    expect(interval.proportion).toBe(0);
    expect(interval.lower).toBe(0);
    expect(interval.upper).toBeGreaterThan(0);
  });

  it("is wider for a small assessment battery than for a large one at the same real proportion", () => {
    const small = calculateProportionConfidenceInterval(3, 5, 0.95); // a short calibration-style battery
    const large = calculateProportionConfidenceInterval(60, 100, 0.95);
    const smallWidth = small.upper - small.lower;
    const largeWidth = large.upper - large.lower;
    expect(smallWidth).toBeGreaterThan(largeWidth);
  });

  it("widens as the requested confidence level increases", () => {
    const ci90 = calculateProportionConfidenceInterval(8, 10, 0.9);
    const ci99 = calculateProportionConfidenceInterval(8, 10, 0.99);
    expect(ci99.upper - ci99.lower).toBeGreaterThan(ci90.upper - ci90.lower);
  });

  it("rejects invalid inputs", () => {
    expect(() => calculateProportionConfidenceInterval(-1, 10)).toThrow();
    expect(() => calculateProportionConfidenceInterval(11, 10)).toThrow();
    expect(() => calculateProportionConfidenceInterval(5, 0)).toThrow();
    expect(() => calculateProportionConfidenceInterval(5, 10, 0)).toThrow();
    expect(() => calculateProportionConfidenceInterval(5, 10, 1)).toThrow();
  });
});

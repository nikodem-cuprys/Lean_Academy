import { describe, expect, it } from "vitest";
import { calculateReadingEfficiencyScore, COMPREHENSION_FLOOR } from "./reading-efficiency-score";

describe("calculateReadingEfficiencyScore", () => {
  it("is the plain WPM * comprehension product at or above the floor", () => {
    expect(calculateReadingEfficiencyScore({ averageWpm: 300, comprehensionAccuracy: 0.9 })).toBeCloseTo(270);
    expect(
      calculateReadingEfficiencyScore({ averageWpm: 300, comprehensionAccuracy: COMPREHENSION_FLOOR })
    ).toBeCloseTo(300 * COMPREHENSION_FLOOR);
  });

  it("applies an extra penalty below the floor, so score drops faster than linear", () => {
    const atFloor = calculateReadingEfficiencyScore({ averageWpm: 300, comprehensionAccuracy: COMPREHENSION_FLOOR });
    const belowFloor = calculateReadingEfficiencyScore({ averageWpm: 300, comprehensionAccuracy: 0.5 });
    const linearExpectation = 300 * 0.5; // what plain WPM * comprehension would have given
    expect(belowFloor).toBeLessThan(linearExpectation);
    expect(belowFloor).toBeLessThan(atFloor);
  });

  it("is continuous across the floor boundary (no cliff)", () => {
    const epsilon = 1e-6;
    const justAbove = calculateReadingEfficiencyScore({
      averageWpm: 300,
      comprehensionAccuracy: COMPREHENSION_FLOOR + epsilon,
    });
    const justBelow = calculateReadingEfficiencyScore({
      averageWpm: 300,
      comprehensionAccuracy: COMPREHENSION_FLOOR - epsilon,
    });
    expect(Math.abs(justAbove - justBelow)).toBeLessThan(0.01);
  });

  it("never rewards extreme speed at very low comprehension over a slower, comprehending read", () => {
    // 450 WPM at 43% comprehension (project_prompt.txt's own "must not be
    // treated as superior" example) vs. 250 WPM at 90% comprehension.
    const fastLowComprehension = calculateReadingEfficiencyScore({ averageWpm: 450, comprehensionAccuracy: 0.43 });
    const slowerHighComprehension = calculateReadingEfficiencyScore({ averageWpm: 250, comprehensionAccuracy: 0.9 });
    expect(fastLowComprehension).toBeLessThan(slowerHighComprehension);
  });
});

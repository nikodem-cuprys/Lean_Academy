import { describe, expect, it } from "vitest";
import { READING_PASSAGES } from "./passages";

describe("READING_PASSAGES — content integrity", () => {
  it("has more than one passage, each with a unique id", () => {
    expect(READING_PASSAGES.length).toBeGreaterThan(1);
    const ids = new Set(READING_PASSAGES.map((p) => p.id));
    expect(ids.size).toBe(READING_PASSAGES.length);
  });

  it("computes wordCount correctly from each passage's text", () => {
    for (const p of READING_PASSAGES) {
      expect(p.wordCount).toBe(p.text.trim().split(/\s+/).length);
      expect(p.wordCount).toBeGreaterThan(50); // long enough for a meaningful WPM measurement
    }
  });

  it("gives every question exactly one valid correct choice among 4 options", () => {
    for (const p of READING_PASSAGES) {
      expect(p.question.choices.length).toBe(4);
      expect(p.question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(p.question.correctIndex).toBeLessThan(p.question.choices.length);
      // No duplicate choices, which would make the question ambiguous.
      expect(new Set(p.question.choices).size).toBe(4);
    }
  });
});

describe("READING_PASSAGES — difficulty tiers (docs/kanban.md's rotation card)", () => {
  it("spans all three difficulty tiers, not just one", () => {
    const tiers = new Set(READING_PASSAGES.map((p) => p.difficultyTier));
    expect(tiers).toEqual(new Set(["beginner", "intermediate", "advanced"]));
  });

  it("has at least two passages in each tier", () => {
    for (const tier of ["beginner", "intermediate", "advanced"] as const) {
      expect(READING_PASSAGES.filter((p) => p.difficultyTier === tier).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("length genuinely varies by tier — beginner shortest, advanced longest, not just labeled differently", () => {
    const avgLength = (tier: string) => {
      const inTier = READING_PASSAGES.filter((p) => p.difficultyTier === tier);
      return inTier.reduce((sum, p) => sum + p.wordCount, 0) / inTier.length;
    };
    const beginnerAvg = avgLength("beginner");
    const intermediateAvg = avgLength("intermediate");
    const advancedAvg = avgLength("advanced");
    expect(beginnerAvg).toBeLessThan(intermediateAvg);
    expect(intermediateAvg).toBeLessThan(advancedAvg);
  });

  it("covers more than three distinct topics, not a narrow slice of genres", () => {
    const topics = new Set(READING_PASSAGES.map((p) => p.topic));
    expect(topics.size).toBeGreaterThan(3);
  });
});

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

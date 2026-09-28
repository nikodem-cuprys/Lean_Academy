import { describe, expect, it } from "vitest";
import { colorTokens } from "./tokens";
import { nativeColorTokens, oklchToHex } from "./native";

describe("oklchToHex", () => {
  it("converts the achromatic extremes exactly", () => {
    expect(oklchToHex("oklch(100% 0 0)")).toBe("#ffffff");
    expect(oklchToHex("oklch(0% 0 0)")).toBe("#000000");
  });

  it("matches CSS Color 4 reference values for saturated colors", () => {
    // sRGB red/green/blue expressed in OKLCH (css color 4 reference conversions)
    expect(oklchToHex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
    expect(oklchToHex("oklch(86.64% 0.2948 142.5)")).toBe("#00ff00");
    expect(oklchToHex("oklch(45.2% 0.3132 264.05)")).toBe("#0000ff");
  });

  it("accepts a unitless lightness too", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
  });

  it("rejects anything that isn't oklch()", () => {
    expect(() => oklchToHex("#fff")).toThrow();
  });
});

describe("nativeColorTokens", () => {
  it("covers every token in both themes as a hex color", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(Object.keys(nativeColorTokens[theme]).sort()).toEqual(Object.keys(colorTokens[theme]).sort());
      for (const hex of Object.values(nativeColorTokens[theme])) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

import { colorTokens } from "./tokens";

/**
 * React Native's color parser doesn't understand oklch(), so the Android
 * app (apps/mobile) gets the same palette converted to hex here, derived
 * from colorTokens at import time rather than transcribed by hand —
 * one fewer copy of the palette to keep in sync.
 *
 * Standard OKLCH -> OKLab -> linear sRGB -> gamma-encoded sRGB
 * (Björn Ottosson's published matrices), clamped into the sRGB gamut.
 */
export function oklchToHex(value: string): string {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) throw new Error(`Not an oklch() color: ${value}`);
  const L = match[2] === "%" ? Number(match[1]) / 100 : Number(match[1]);
  const C = Number(match[3]);
  const h = (Number(match[4]) * Math.PI) / 180;

  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return (
    "#" +
    linear
      .map((c) => {
        const clamped = Math.min(1, Math.max(0, c));
        const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

type ColorKey = keyof (typeof colorTokens)["light"];
export type NativeColorPalette = Record<ColorKey, string>;

function toHexPalette(palette: (typeof colorTokens)["light" | "dark"]): NativeColorPalette {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [key, oklchToHex(value)])
  ) as NativeColorPalette;
}

export const nativeColorTokens: { light: NativeColorPalette; dark: NativeColorPalette } = {
  light: toHexPalette(colorTokens.light),
  dark: toHexPalette(colorTokens.dark),
};

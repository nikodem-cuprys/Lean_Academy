/**
 * Design tokens, transcribed from the approved prototype
 * (prototype/Styleguide.dc.html) and docs/design-system.md. Both are the
 * source of truth for these values — if you change a color here, update
 * the prototype too (and vice versa), the same way evidence-review.md
 * and evidence-registry.json have to stay in sync.
 *
 * Values are oklch() strings so they can be dropped directly into CSS
 * custom properties or a Tailwind v4 @theme block.
 */

export const colorTokens = {
  light: {
    bg: "oklch(98% 0.004 95)",
    surface: "oklch(99.5% 0.002 95)",
    surface2: "oklch(96.2% 0.006 95)",
    border: "oklch(90% 0.008 95)",
    text: "oklch(22% 0.02 265)",
    text2: "oklch(46% 0.02 265)",
    text3: "oklch(52% 0.015 265)",
    accent: "oklch(56% 0.19 276)",
    accentStrong: "oklch(46% 0.19 276)",
    accentSoft: "oklch(94% 0.035 276)",
    onAccent: "oklch(99% 0.004 276)",
    workingMemory: "oklch(52% 0.15 276)",
    workingMemorySoft: "oklch(94% 0.03 276)",
    reading: "oklch(52% 0.16 75)",
    readingSoft: "oklch(95% 0.04 75)",
    spatial: "oklch(50% 0.10 195)",
    spatialSoft: "oklch(94% 0.025 195)",
    success: "oklch(62% 0.14 150)",
    successSoft: "oklch(95% 0.03 150)",
    caution: "oklch(64% 0.19 35)",
    cautionSoft: "oklch(95% 0.045 35)",
  },
  dark: {
    bg: "oklch(17% 0.012 265)",
    surface: "oklch(21% 0.014 265)",
    surface2: "oklch(25% 0.016 265)",
    border: "oklch(32% 0.018 265)",
    text: "oklch(95% 0.006 265)",
    text2: "oklch(78% 0.012 265)",
    text3: "oklch(60% 0.014 265)",
    accent: "oklch(74% 0.15 276)",
    accentStrong: "oklch(82% 0.13 276)",
    accentSoft: "oklch(32% 0.06 276)",
    onAccent: "oklch(14% 0.02 276)",
    workingMemory: "oklch(74% 0.13 276)",
    workingMemorySoft: "oklch(30% 0.05 276)",
    reading: "oklch(78% 0.13 75)",
    readingSoft: "oklch(33% 0.06 75)",
    spatial: "oklch(72% 0.09 195)",
    spatialSoft: "oklch(30% 0.04 195)",
    success: "oklch(72% 0.13 150)",
    successSoft: "oklch(30% 0.05 150)",
    caution: "oklch(74% 0.16 35)",
    cautionSoft: "oklch(34% 0.07 35)",
  },
} as const;

export const radiusTokens = {
  sm: "10px",
  md: "16px",
  lg: "24px",
  full: "999px",
} as const;

export const spacingScale = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const fontTokens = {
  display: "'Sora', system-ui, sans-serif",
  body: "'Manrope', system-ui, sans-serif",
  num: "'Space Grotesk', system-ui, sans-serif",
} as const;

/** Domains a training exercise can belong to, and their token key. */
export const domainColorKey = {
  WORKING_MEMORY: "workingMemory",
  READING: "reading",
  SPATIAL: "spatial",
} as const;

/**
 * Named durations/easings per docs/design-system.md's Motion section —
 * micro for button/tap feedback, transition for screen/phase changes,
 * celebration for level-up moments. Same values regardless of theme.
 */
export const motionTokens = {
  durationMicro: "150ms",
  durationTransition: "250ms",
  durationCelebration: "500ms",
  easeStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeCelebration: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

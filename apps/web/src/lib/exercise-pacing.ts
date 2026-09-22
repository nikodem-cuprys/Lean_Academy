// Pure constants for the free, opt-in exercise-customization settings
// (see exercise-preferences.ts) — pulled into their own leaf module
// with zero imports so a "use client" component (ExerciseSettingsView)
// can import the real values, not just types. exercise-preferences.ts
// imports @lean-academy/db (Prisma), and this project has hit the same
// client-bundle crash twice already from a client component importing
// even one runtime value from a Prisma-importing lib module — see
// CLAUDE.md's "a 'use client' component cannot import even one runtime
// constant/function from a server-only module" gotcha.

export const PACE_PRESETS = ["RELAXED", "STANDARD", "QUICK", "NO_DELAY"] as const;
export type PacePreset = (typeof PACE_PRESETS)[number];

export const PACE_PRESET_LABELS: Record<PacePreset, string> = {
  RELAXED: "Relaxed",
  STANDARD: "Standard",
  QUICK: "Quick",
  NO_DELAY: "No delay",
};

export const PACE_PRESET_DESCRIPTIONS: Record<PacePreset, string> = {
  RELAXED: "More time per item — easier pacing.",
  STANDARD: "The default pacing this exercise's evidence base was studied at.",
  QUICK: "Less time per item — harder pacing.",
  NO_DELAY: "Minimum possible pacing between items — fastest, hardest.",
};

export const DEFAULT_PACE: PacePreset = "STANDARD";

export const DIE_SIDES_OPTIONS = [4, 6, 8, 10, 12, 20] as const;
export type DieSides = (typeof DIE_SIDES_OPTIONS)[number];
export const DEFAULT_DIE_SIDES: DieSides = 6;

// Mirrors packages/cognitive-engine/src/spatial-sequence.ts's own
// SPATIAL_GRID_SIZE_OPTIONS (a small, stable list) rather than
// importing it — kept as its own copy for the same reason DIE_SIDES_OPTIONS
// above is, so this module's only import surface stays "things safe
// for a client bundle," not a live dependency on another package's
// exports.
export const GRID_SIZE_OPTIONS = [9, 16, 25] as const;
export type GridSize = (typeof GRID_SIZE_OPTIONS)[number];
export const DEFAULT_GRID_SIZE: GridSize = 9;
export const GRID_SIZE_LABELS: Record<GridSize, string> = {
  9: "3×3",
  16: "4×4",
  25: "5×5",
};

/** Methods whose standalone exercise has a configurable inter-stimulus pace. */
export const PACED_METHODS = ["adaptive-nback-v0", "complex-span-v0", "visuospatial-sequence-recall-v0"] as const;
export type PacedMethod = (typeof PACED_METHODS)[number];

export const DICE_METHOD = "dice-sum-v0";
/** The one paced method that also has a second, independent setting (grid size). */
export const SPATIAL_METHOD = "visuospatial-sequence-recall-v0" as const;

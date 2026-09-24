// The Advanced tab (/advanced): fully user-chosen exercise parameters —
// timings, grid sizes, target WPM, run length, starting level, and
// whether difficulty adapts at all — for personal practice.
//
// Deliberately separate from both the guided daily session and the
// standalone /train/<exercise> routes: an advanced lesson never writes
// TrainingSession/Trial/DifficultyState rows, never earns XP or counts
// toward streaks/quests, and never shows on /progress. Its results go
// only to the AdvancedRun table and the Advanced tab's own history.
// That's the whole point of the separation — most of these values are
// outside the parameters each exercise's evidence base was studied at,
// so mixing them into the main progression would make it incomparable
// session to session.
//
// Zero imports on purpose, same as exercise-pacing.ts: "use client"
// components import the real specs from here (see CLAUDE.md's
// server-only-module gotcha). The server side (advanced-runs.ts, the
// API routes) validates every write through sanitizeAdvancedSettings,
// so the client can never persist an out-of-range value.

export const ADVANCED_METHODS = [
  "adaptive-nback-v0",
  "complex-span-v0",
  "visuospatial-sequence-recall-v0",
  "dice-sum-v0",
  "reading-paced-adaptive-v0",
] as const;
export type AdvancedMethod = (typeof ADVANCED_METHODS)[number];

/** URL slug per method — /advanced/<slug>. */
export const ADVANCED_SLUGS: Record<AdvancedMethod, string> = {
  "adaptive-nback-v0": "n-back",
  "complex-span-v0": "complex-span",
  "visuospatial-sequence-recall-v0": "spatial-sequence",
  "dice-sum-v0": "dice-sum",
  "reading-paced-adaptive-v0": "reading",
};

export function methodFromSlug(slug: string): AdvancedMethod | null {
  const entry = Object.entries(ADVANCED_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as AdvancedMethod) : null;
}

/**
 * One tunable parameter. `unit` picks the display format; the label and
 * hint text live in the messages files (advanced.params.<key>).
 * `maxFromKey` caps a range by another setting's current value — used
 * for Spatial Sequence, where a sequence can't be longer than the grid
 * has cells.
 */
export type ParamSpec =
  | { key: string; kind: "range"; min: number; max: number; step: number; default: number; unit: "ms" | "percent" | "wpm" | "count"; maxFromKey?: string }
  | { key: string; kind: "choice"; options: readonly number[]; default: number; unit: "grid" | "die" }
  | { key: string; kind: "toggle"; default: boolean };

// Defaults mirror each exercise component's own constants exactly, so
// "Reset to defaults" really does reproduce the standard lesson.
export const ADVANCED_PARAM_SPECS: Record<AdvancedMethod, readonly ParamSpec[]> = {
  "adaptive-nback-v0": [
    { key: "startLevel", kind: "range", min: 1, max: 9, step: 1, default: 2, unit: "count" },
    { key: "adaptive", kind: "toggle", default: true },
    { key: "gridSize", kind: "choice", options: [9, 16, 25], default: 9, unit: "grid" },
    { key: "trials", kind: "range", min: 10, max: 60, step: 5, default: 20, unit: "count" },
    { key: "stimulusMs", kind: "range", min: 500, max: 5000, step: 100, default: 2500, unit: "ms" },
    { key: "feedbackMs", kind: "range", min: 0, max: 2000, step: 50, default: 650, unit: "ms" },
    { key: "matchPercent", kind: "range", min: 10, max: 60, step: 5, default: 30, unit: "percent" },
  ],
  "complex-span-v0": [
    { key: "startLevel", kind: "range", min: 3, max: 9, step: 1, default: 4, unit: "count" },
    { key: "adaptive", kind: "toggle", default: true },
    { key: "sets", kind: "range", min: 3, max: 10, step: 1, default: 5, unit: "count" },
    { key: "memoryDisplayMs", kind: "range", min: 300, max: 3000, step: 100, default: 1200, unit: "ms" },
    { key: "processingLimitMs", kind: "range", min: 2000, max: 12000, step: 500, default: 6000, unit: "ms" },
    { key: "feedbackMs", kind: "range", min: 0, max: 3000, step: 100, default: 900, unit: "ms" },
  ],
  "visuospatial-sequence-recall-v0": [
    { key: "gridSize", kind: "choice", options: [9, 16, 25], default: 9, unit: "grid" },
    { key: "startLevel", kind: "range", min: 3, max: 25, step: 1, default: 4, unit: "count", maxFromKey: "gridSize" },
    { key: "adaptive", kind: "toggle", default: true },
    { key: "sequences", kind: "range", min: 3, max: 10, step: 1, default: 5, unit: "count" },
    { key: "itemDisplayMs", kind: "range", min: 200, max: 2000, step: 50, default: 800, unit: "ms" },
    { key: "itemGapMs", kind: "range", min: 0, max: 1000, step: 50, default: 300, unit: "ms" },
    { key: "feedbackMs", kind: "range", min: 0, max: 3000, step: 100, default: 900, unit: "ms" },
  ],
  "dice-sum-v0": [
    { key: "dieSides", kind: "choice", options: [4, 6, 8, 10, 12, 20], default: 6, unit: "die" },
    { key: "startLevel", kind: "range", min: 3, max: 8, step: 1, default: 5, unit: "count" },
    { key: "adaptive", kind: "toggle", default: true },
    { key: "rounds", kind: "range", min: 3, max: 10, step: 1, default: 5, unit: "count" },
    { key: "showMs", kind: "range", min: 1000, max: 10000, step: 250, default: 4000, unit: "ms" },
    { key: "feedbackMs", kind: "range", min: 0, max: 3000, step: 100, default: 1400, unit: "ms" },
  ],
  // Reading has no adaptive toggle: an advanced reading lesson always
  // holds the pace guide at exactly the WPM chosen here.
  "reading-paced-adaptive-v0": [
    { key: "targetWpm", kind: "range", min: 100, max: 800, step: 10, default: 220, unit: "wpm" },
    { key: "passages", kind: "range", min: 1, max: 10, step: 1, default: 5, unit: "count" },
    { key: "chunkSize", kind: "range", min: 1, max: 8, step: 1, default: 4, unit: "count" },
    { key: "feedbackMs", kind: "range", min: 0, max: 3000, step: 100, default: 1400, unit: "ms" },
  ],
};

export type AdvancedSettings = Record<string, number | boolean>;

export interface NBackAdvanced {
  startLevel: number;
  adaptive: boolean;
  gridSize: number;
  trials: number;
  stimulusMs: number;
  feedbackMs: number;
  matchPercent: number;
}
export interface ComplexSpanAdvanced {
  startLevel: number;
  adaptive: boolean;
  sets: number;
  memoryDisplayMs: number;
  processingLimitMs: number;
  feedbackMs: number;
}
export interface SpatialAdvanced {
  gridSize: 9 | 16 | 25;
  startLevel: number;
  adaptive: boolean;
  sequences: number;
  itemDisplayMs: number;
  itemGapMs: number;
  feedbackMs: number;
}
export interface DiceSumAdvanced {
  dieSides: 4 | 6 | 8 | 10 | 12 | 20;
  startLevel: number;
  adaptive: boolean;
  rounds: number;
  showMs: number;
  feedbackMs: number;
}
export interface ReadingAdvanced {
  targetWpm: number;
  passages: number;
  chunkSize: number;
  feedbackMs: number;
}

export function defaultAdvancedSettings(method: AdvancedMethod): AdvancedSettings {
  return Object.fromEntries(ADVANCED_PARAM_SPECS[method].map((spec) => [spec.key, spec.default]));
}

/** Effective max for a range spec, given the other settings it may depend on. */
export function effectiveMax(spec: Extract<ParamSpec, { kind: "range" }>, settings: AdvancedSettings): number {
  if (!spec.maxFromKey) return spec.max;
  const cap = settings[spec.maxFromKey];
  return typeof cap === "number" ? Math.min(spec.max, cap) : spec.max;
}

/**
 * Coerces arbitrary input (a stored JSON blob, a request body) into a
 * complete, valid settings object for `method`: unknown keys dropped,
 * missing/invalid values replaced by defaults, ranges clamped and
 * snapped to their step. Choice specs are processed before the range
 * specs that cap against them, which is why each spec list orders
 * gridSize ahead of startLevel where it matters.
 */
export function sanitizeAdvancedSettings(method: AdvancedMethod, raw: unknown): AdvancedSettings {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: AdvancedSettings = {};
  for (const spec of ADVANCED_PARAM_SPECS[method]) {
    const value = input[spec.key];
    if (spec.kind === "toggle") {
      out[spec.key] = typeof value === "boolean" ? value : spec.default;
    } else if (spec.kind === "choice") {
      out[spec.key] = typeof value === "number" && spec.options.includes(value) ? value : spec.default;
    } else {
      const max = effectiveMax(spec, out);
      if (typeof value !== "number" || !Number.isFinite(value)) {
        out[spec.key] = Math.min(spec.default, max);
        continue;
      }
      const snapped = spec.min + Math.round((value - spec.min) / spec.step) * spec.step;
      out[spec.key] = Math.min(max, Math.max(spec.min, snapped));
    }
  }
  return out;
}

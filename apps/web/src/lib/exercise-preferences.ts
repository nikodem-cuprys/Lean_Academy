import { prisma, Prisma } from "@lean-academy/db";
import {
  PACE_PRESETS,
  DEFAULT_PACE,
  PACED_METHODS,
  DIE_SIDES_OPTIONS,
  DEFAULT_DIE_SIDES,
  DICE_METHOD,
  GRID_SIZE_OPTIONS,
  DEFAULT_GRID_SIZE,
  SPATIAL_METHOD,
  type PacePreset,
  type PacedMethod,
  type DieSides,
  type GridSize,
} from "@/lib/exercise-pacing";

export {
  PACE_PRESETS,
  PACE_PRESET_LABELS,
  PACE_PRESET_DESCRIPTIONS,
  DEFAULT_PACE,
  PACED_METHODS,
  DIE_SIDES_OPTIONS,
  DEFAULT_DIE_SIDES,
  DICE_METHOD,
  GRID_SIZE_OPTIONS,
  GRID_SIZE_LABELS,
  DEFAULT_GRID_SIZE,
  SPATIAL_METHOD,
  type PacePreset,
  type PacedMethod,
  type DieSides,
  type GridSize,
} from "@/lib/exercise-pacing";

// Free, opt-in presentation-parameter customization for exercises that
// have a real timing or stimulus-shape knob worth exposing — see
// docs/kanban.md's Gamification epic ("more customization to lessons").
// Confirmed with the user to ship free rather than premium-gated
// (unlike docs/monetization-plan.md's general "customization" premium
// category — that's aimed at future features like additional themes
// and personalized training plans, not this one).
//
// Deliberately scoped to standalone /train/<exercise> practice only,
// never the guided daily session (TrainingSessionRunner doesn't read
// these) — the "Today's Training" flow keeps the scientifically
// calibrated default pacing so a user's adaptive difficulty
// progression stays comparable session to session; standalone practice
// is where personalization belongs. A setting never changes what's
// scored as correct/incorrect — pace changes only how fast stimuli are
// shown; Dice Sum's die sides and Spatial Sequence's grid size do
// change what the adaptive engine's difficulty ceiling means (a bigger
// grid can hold a longer real sequence), but never how a given attempt
// is scored.
//
// One generic ExercisePreference row per (user, method), `settings` a
// small per-method JSON shape validated here at the read/write
// boundary — same "generic Json column, typed where it's used" pattern
// packages/db's Challenge.criteria already established, rather than a
// bespoke column-per-setting model for every exercise. Every setter
// merges into the existing settings object rather than overwriting it
// wholesale — Spatial Sequence is the one method with two independent
// settings (pace and gridSize) sharing a single row, and a blind
// overwrite would silently erase whichever one wasn't just being set.
// The pure constants (preset names/labels/descriptions) live in the
// sibling exercise-pacing.ts, which has no Prisma import, so a "use
// client" component can import the real values from there instead of
// from this Prisma-importing module — see that file's own comment.

function isPacePreset(value: unknown): value is PacePreset {
  return typeof value === "string" && (PACE_PRESETS as readonly string[]).includes(value);
}

function isDieSides(value: unknown): value is DieSides {
  return typeof value === "number" && (DIE_SIDES_OPTIONS as readonly number[]).includes(value);
}

function isGridSize(value: unknown): value is GridSize {
  return typeof value === "number" && (GRID_SIZE_OPTIONS as readonly number[]).includes(value);
}

async function mergeSettings(userId: string, method: string, patch: Record<string, unknown>): Promise<void> {
  const existing = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method } } });
  const merged = { ...((existing?.settings as Record<string, unknown> | undefined) ?? {}), ...patch };
  await prisma.exercisePreference.upsert({
    where: { userId_method: { userId, method } },
    create: { userId, method, settings: merged as Prisma.InputJsonValue },
    update: { settings: merged as Prisma.InputJsonValue },
  });
}

/** Real per-user preference for one paced exercise's pace, or the default if never set. */
export async function getPacePreference(userId: string, method: PacedMethod): Promise<PacePreset> {
  const row = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method } } });
  const settings = row?.settings as { pace?: unknown } | undefined;
  return isPacePreset(settings?.pace) ? settings.pace : DEFAULT_PACE;
}

export async function setPacePreference(userId: string, method: PacedMethod, pace: PacePreset): Promise<void> {
  await mergeSettings(userId, method, { pace });
}

/** Real per-user preference for Dice Sum's die sides, or the default (6) if never set. */
export async function getDieSidesPreference(userId: string): Promise<DieSides> {
  const row = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method: DICE_METHOD } } });
  const settings = row?.settings as { dieSides?: unknown } | undefined;
  return isDieSides(settings?.dieSides) ? settings.dieSides : DEFAULT_DIE_SIDES;
}

export async function setDieSidesPreference(userId: string, dieSides: DieSides): Promise<void> {
  await mergeSettings(userId, DICE_METHOD, { dieSides });
}

/** Real per-user preference for Spatial Sequence's grid size, or the default (9, a 3x3) if never set. */
export async function getGridSizePreference(userId: string): Promise<GridSize> {
  const row = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method: SPATIAL_METHOD } } });
  const settings = row?.settings as { gridSize?: unknown } | undefined;
  return isGridSize(settings?.gridSize) ? settings.gridSize : DEFAULT_GRID_SIZE;
}

export async function setGridSizePreference(userId: string, gridSize: GridSize): Promise<void> {
  await mergeSettings(userId, SPATIAL_METHOD, { gridSize });
}

export interface AllExercisePreferences {
  pace: Record<PacedMethod, PacePreset>;
  dieSides: DieSides;
  gridSize: GridSize;
}

/** Every customizable exercise's current preference for this user, in one query — backs the /settings/exercises page. */
export async function getAllExercisePreferences(userId: string): Promise<AllExercisePreferences> {
  const rows = await prisma.exercisePreference.findMany({
    where: { userId, method: { in: [...PACED_METHODS, DICE_METHOD] } },
  });
  const byMethod = new Map(rows.map((r) => [r.method, r.settings as { pace?: unknown; dieSides?: unknown; gridSize?: unknown }]));

  const pace = Object.fromEntries(
    PACED_METHODS.map((method) => {
      const settings = byMethod.get(method);
      return [method, isPacePreset(settings?.pace) ? settings.pace : DEFAULT_PACE];
    })
  ) as Record<PacedMethod, PacePreset>;

  const diceSettings = byMethod.get(DICE_METHOD);
  const dieSides = isDieSides(diceSettings?.dieSides) ? diceSettings.dieSides : DEFAULT_DIE_SIDES;

  const spatialSettings = byMethod.get(SPATIAL_METHOD);
  const gridSize = isGridSize(spatialSettings?.gridSize) ? spatialSettings.gridSize : DEFAULT_GRID_SIZE;

  return { pace, dieSides, gridSize };
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  PACE_PRESETS,
  DIE_SIDES_OPTIONS,
  GRID_SIZE_OPTIONS,
  GRID_SIZE_LABELS,
  type PacePreset,
  type PacedMethod,
  type DieSides,
  type GridSize,
} from "@/lib/exercise-pacing";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// No prototype/*.dc.html artboard exists for this screen (checked) —
// built to match the card-shell visual pattern ChallengesView.tsx/
// AchievementsView.tsx already established rather than inventing a new
// one. Free, opt-in customization (see apps/web/src/lib/
// exercise-preferences.ts) — every setting here only changes how a
// standalone /train/<exercise> practice run is presented, never what's
// scored or how the adaptive engine adjusts difficulty, and never
// applies to the guided daily session.

interface PacedExercise {
  method: PacedMethod;
  displayName: string;
  pace: PacePreset;
}

interface DiceExercise {
  method: string;
  displayName: string;
  dieSides: DieSides;
}

interface SpatialGridExercise {
  method: string;
  displayName: string;
  gridSize: GridSize;
}

type SaveState = "idle" | "saving" | "saved" | "error";

async function saveExercisePreference(
  body: { method: string; pace: PacePreset } | { method: string; dieSides: DieSides } | { method: string; gridSize: GridSize }
) {
  const res = await fetch("/api/exercise-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save preference.");
}

function SaveStatus({ state }: { state: SaveState }) {
  const t = useTranslations("settings");
  if (state === "saving") return <span className="text-xs text-text-3">{t("saving")}</span>;
  if (state === "saved") return <span className="text-xs text-success">{t("saved")}</span>;
  if (state === "error") return <span className="text-xs" style={{ color: "var(--color-caution)" }}>{t("saveError")}</span>;
  return null;
}

// Exercise names shown in the viewer's language (messages "methods"),
// falling back to the registry's English displayName.
function useExerciseName() {
  const tm = useTranslations("methods");
  return (method: string, fallback: string) => (tm.has(method as never) ? tm(method as never) : fallback);
}

function PaceRow({ exercise }: { exercise: PacedExercise }) {
  const t = useTranslations("settings");
  const exerciseName = useExerciseName();
  const [pace, setPace] = useState<PacePreset>(exercise.pace);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function handleChange(next: PacePreset) {
    setPace(next);
    setSaveState("saving");
    try {
      await saveExercisePreference({ method: exercise.method, pace: next });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div data-testid={`exercise-setting-${exercise.method}`} className="border-b border-border py-4 last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[14px] font-bold text-text">{exerciseName(exercise.method, exercise.displayName)}</div>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-2.5 text-xs text-text-3">{t("stimulusPace")}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {PACE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`pace-${exercise.method}-${preset}`}
            onClick={() => handleChange(preset)}
            aria-pressed={pace === preset}
            title={t(`pace.${preset}.description`)}
            className="rounded-[10px] border px-1.5 py-2 text-center text-[11.5px] font-bold transition-colors"
            style={
              pace === preset
                ? { borderColor: "var(--color-wm)", background: "var(--color-wm-soft)", color: "var(--color-wm)" }
                : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-2)" }
            }
          >
            {t(`pace.${preset}.label`)}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[11.5px] text-text-3">{t(`pace.${pace}.description`)}</div>
    </div>
  );
}

function DiceRow({ exercise }: { exercise: DiceExercise }) {
  const t = useTranslations("settings");
  const exerciseName = useExerciseName();
  const [dieSides, setDieSides] = useState<DieSides>(exercise.dieSides);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function handleChange(next: DieSides) {
    setDieSides(next);
    setSaveState("saving");
    try {
      await saveExercisePreference({ method: exercise.method, dieSides: next });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div data-testid={`exercise-setting-${exercise.method}`} className="border-b border-border py-4 last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[14px] font-bold text-text">{exerciseName(exercise.method, exercise.displayName)}</div>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-2.5 text-xs text-text-3">{t("dieSides")}</div>
      <div className="grid grid-cols-6 gap-1.5">
        {DIE_SIDES_OPTIONS.map((sides) => (
          <button
            key={sides}
            type="button"
            data-testid={`dice-sides-${sides}`}
            onClick={() => handleChange(sides)}
            aria-pressed={dieSides === sides}
            className="rounded-[10px] border py-2 text-center font-num text-[13px] font-bold transition-colors"
            style={
              dieSides === sides
                ? { borderColor: "var(--color-wm)", background: "var(--color-wm-soft)", color: "var(--color-wm)" }
                : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-2)" }
            }
          >
            d{sides}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[11.5px] text-text-3">
        {dieSides === 6 ? t("dieStandard") : t("dieCustom", { sides: dieSides })}
      </div>
    </div>
  );
}

function GridSizeRow({ exercise }: { exercise: SpatialGridExercise }) {
  const t = useTranslations("settings");
  const [gridSize, setGridSize] = useState<GridSize>(exercise.gridSize);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function handleChange(next: GridSize) {
    setGridSize(next);
    setSaveState("saving");
    try {
      await saveExercisePreference({ method: exercise.method, gridSize: next });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div data-testid={`exercise-setting-${exercise.method}-grid`} className="border-b border-border py-4 last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[14px] font-bold text-text">{t("gridSize")}</div>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-2.5 text-xs text-text-3">{t("gridSizeHint")}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {GRID_SIZE_OPTIONS.map((size) => (
          <button
            key={size}
            type="button"
            data-testid={`grid-size-${size}`}
            onClick={() => handleChange(size)}
            aria-pressed={gridSize === size}
            className="rounded-[10px] border py-2 text-center font-num text-[13px] font-bold transition-colors"
            style={
              gridSize === size
                ? { borderColor: "var(--color-spatial)", background: "var(--color-spatial-soft)", color: "var(--color-spatial)" }
                : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-2)" }
            }
          >
            {GRID_SIZE_LABELS[size]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseSettingsView({
  pacedExercises,
  diceExercise,
  spatialGridExercise,
}: {
  pacedExercises: PacedExercise[];
  diceExercise: DiceExercise;
  spatialGridExercise: SpatialGridExercise;
}) {
  const t = useTranslations("settings");
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="font-display text-[23px] font-bold text-text">{t("title")}</h1>
      <p className="mb-4 text-[13px] text-text-2">{t("intro")}</p>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4.5 py-3.5 shadow-sm">
        <div className="text-[14px] font-bold text-text">{t("language")}</div>
        <LanguageSwitcher />
      </div>

      <div className="rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {pacedExercises.map((exercise) => (
          <div key={exercise.method}>
            <PaceRow exercise={exercise} />
            {exercise.method === spatialGridExercise.method ? <GridSizeRow exercise={spatialGridExercise} /> : null}
          </div>
        ))}
        <DiceRow exercise={diceExercise} />
      </div>
    </div>
  );
}

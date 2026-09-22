"use client";

import { useState } from "react";
import {
  PACE_PRESETS,
  PACE_PRESET_LABELS,
  PACE_PRESET_DESCRIPTIONS,
  DIE_SIDES_OPTIONS,
  type PacePreset,
  type PacedMethod,
  type DieSides,
} from "@/lib/exercise-pacing";

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

type SaveState = "idle" | "saving" | "saved" | "error";

async function saveExercisePreference(body: { method: string; pace: PacePreset } | { method: string; dieSides: DieSides }) {
  const res = await fetch("/api/exercise-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save preference.");
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-xs text-text-3">Saving…</span>;
  if (state === "saved") return <span className="text-xs text-success">Saved</span>;
  if (state === "error") return <span className="text-xs" style={{ color: "var(--color-caution)" }}>Couldn&rsquo;t save — try again</span>;
  return null;
}

function PaceRow({ exercise }: { exercise: PacedExercise }) {
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
        <div className="text-[14px] font-bold text-text">{exercise.displayName}</div>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-2.5 text-xs text-text-3">Stimulus pace</div>
      <div className="grid grid-cols-4 gap-1.5">
        {PACE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`pace-${exercise.method}-${preset}`}
            onClick={() => handleChange(preset)}
            aria-pressed={pace === preset}
            title={PACE_PRESET_DESCRIPTIONS[preset]}
            className="rounded-[10px] border px-1.5 py-2 text-center text-[11.5px] font-bold transition-colors"
            style={
              pace === preset
                ? { borderColor: "var(--color-wm)", background: "var(--color-wm-soft)", color: "var(--color-wm)" }
                : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-2)" }
            }
          >
            {PACE_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[11.5px] text-text-3">{PACE_PRESET_DESCRIPTIONS[pace]}</div>
    </div>
  );
}

function DiceRow({ exercise }: { exercise: DiceExercise }) {
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
        <div className="text-[14px] font-bold text-text">{exercise.displayName}</div>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-2.5 text-xs text-text-3">Die sides</div>
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
        {dieSides === 6
          ? "The standard 6-sided die — dice count still adapts to your difficulty."
          : `A ${dieSides}-sided die makes each round's sums bigger — dice count still adapts to your difficulty separately.`}
      </div>
    </div>
  );
}

export function ExerciseSettingsView({
  pacedExercises,
  diceExercise,
}: {
  pacedExercises: PacedExercise[];
  diceExercise: DiceExercise;
}) {
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="font-display text-[23px] font-bold text-text">Customize exercises</h1>
      <p className="mb-4 text-[13px] text-text-2">
        Applies to standalone practice only, not your daily training session — which stays at the pace its research
        was studied at so your adaptive difficulty progression stays comparable session to session.
      </p>

      <div className="rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {pacedExercises.map((exercise) => (
          <PaceRow key={exercise.method} exercise={exercise} />
        ))}
        <DiceRow exercise={diceExercise} />
      </div>
    </div>
  );
}

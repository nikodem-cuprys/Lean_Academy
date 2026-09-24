"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ADVANCED_PARAM_SPECS,
  defaultAdvancedSettings,
  effectiveMax,
  sanitizeAdvancedSettings,
  type AdvancedMethod,
  type AdvancedSettings,
  type ComplexSpanAdvanced,
  type DiceSumAdvanced,
  type NBackAdvanced,
  type ParamSpec,
  type ReadingAdvanced,
  type SpatialAdvanced,
} from "@/lib/advanced-settings";
import type { ExerciseSessionOutcome } from "@/lib/session-types";
import { NBackExercise } from "@/components/NBackExercise";
import { ComplexSpanExercise } from "@/components/ComplexSpanExercise";
import { SpatialSequenceExercise } from "@/components/SpatialSequenceExercise";
import { DiceSumExercise } from "@/components/DiceSumExercise";
import { PacedReadingExercise } from "@/components/PacedReadingExercise";
import { AdvancedRunList, METHOD_COLOR, useExerciseName, type AdvancedRunView } from "@/components/AdvancedRunList";

// /advanced/<slug>: configure every parameter of one exercise, then run
// it right here as an Advanced lesson. The exercise components run in
// their session mode (onComplete), so they skip their own results
// screen and hand the outcome back; it's saved to AdvancedRun only,
// never through /api/training-sessions/* — see
// apps/web/src/lib/advanced-settings.ts for why advanced lessons are a
// separate track from main and daily training.

const SAVE_DEBOUNCE_MS = 500;
const GRID_LABELS: Record<number, string> = { 9: "3×3", 16: "4×4", 25: "5×5" };

type SaveState = "idle" | "saving" | "saved" | "error";
type Phase = "configure" | "running" | "result";

interface LessonResult {
  trialCount: number;
  correctCount: number;
  startLevel: number;
  endLevel: number;
  averageWpm?: number;
  saved: boolean;
}

async function putSettings(method: AdvancedMethod, settings: AdvancedSettings): Promise<void> {
  const res = await fetch("/api/advanced/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, settings }),
  });
  if (!res.ok) throw new Error("Failed to save advanced settings.");
}

function summarizeOutcome(method: AdvancedMethod, settings: AdvancedSettings, outcome: ExerciseSessionOutcome): Omit<LessonResult, "saved"> {
  // Interrupted trials (tab hidden mid-trial) are recorded but never
  // scored — same rule as the main training's own accuracy figures.
  const scored = outcome.trials.filter((trial) => !trial.wasInterrupted);
  const correctCount = scored.filter((trial) => trial.correct).length;
  if (method === "reading-paced-adaptive-v0") {
    const wpms = scored.map((trial) => trial.metadata?.actualWpm).filter((w): w is number => typeof w === "number");
    const targetWpm = settings.targetWpm as number;
    return {
      trialCount: scored.length,
      correctCount,
      startLevel: targetWpm,
      endLevel: targetWpm,
      averageWpm: wpms.length > 0 ? wpms.reduce((a, b) => a + b, 0) / wpms.length : 0,
    };
  }
  return { trialCount: scored.length, correctCount, startLevel: outcome.startDifficulty, endLevel: outcome.endDifficulty };
}

function SaveStatus({ state }: { state: SaveState }) {
  const t = useTranslations("settings");
  if (state === "saving") return <span className="text-xs text-text-3">{t("saving")}</span>;
  if (state === "saved") return <span className="text-xs text-success">{t("saved")}</span>;
  if (state === "error") return <span className="text-xs" style={{ color: "var(--color-caution)" }}>{t("saveError")}</span>;
  return null;
}

function ParamControl({
  method,
  spec,
  settings,
  onChange,
}: {
  method: AdvancedMethod;
  spec: ParamSpec;
  settings: AdvancedSettings;
  onChange: (key: string, value: number | boolean) => void;
}) {
  const t = useTranslations("advanced");
  const labelKey = spec.key === "startLevel" ? `startLevel.${method}` : `params.${spec.key}.label`;
  const hintKey = `params.${spec.key}.hint`;
  const label = t(labelKey as never);
  const hint = t.has(hintKey as never) ? t(hintKey as never) : null;
  const inputId = `advanced-${spec.key}`;
  const value = settings[spec.key];

  if (spec.kind === "toggle") {
    const on = value === true;
    return (
      <div className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-0">
        <div>
          <div id={`${inputId}-label`} className="text-[13.5px] font-bold text-text">{label}</div>
          {hint ? <div className="text-[11.5px] text-text-3">{hint}</div> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${inputId}-label`}
          data-testid={`advanced-param-${spec.key}`}
          onClick={() => onChange(spec.key, !on)}
          className="relative h-7 w-12 flex-shrink-0 rounded-full transition-colors"
          style={{ background: on ? "var(--color-accent)" : "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <span
            className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-surface shadow-sm transition-all"
            style={{ left: on ? "calc(100% - 24px)" : "2px" }}
          />
        </button>
      </div>
    );
  }

  if (spec.kind === "choice") {
    return (
      <div className="border-b border-border py-3.5 last:border-0">
        <div id={`${inputId}-label`} className="mb-2 text-[13.5px] font-bold text-text">{label}</div>
        <div role="group" aria-labelledby={`${inputId}-label`} className="flex flex-wrap gap-1.5">
          {spec.options.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                data-testid={`advanced-param-${spec.key}-${option}`}
                onClick={() => onChange(spec.key, option)}
                className="min-w-[52px] flex-1 rounded-[10px] border px-2 py-2 text-center font-num text-[13px] font-bold transition-colors"
                style={
                  selected
                    ? { borderColor: "var(--color-accent)", background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
                    : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-2)" }
                }
              >
                {spec.unit === "grid" ? GRID_LABELS[option] ?? option : `d${option}`}
              </button>
            );
          })}
        </div>
        {hint ? <div className="mt-1.5 text-[11.5px] text-text-3">{hint}</div> : null}
      </div>
    );
  }

  const max = effectiveMax(spec, settings);
  const numeric = typeof value === "number" ? value : spec.default;
  const display =
    spec.unit === "ms"
      ? t("units.ms", { value: numeric })
      : spec.unit === "percent"
        ? t("units.percent", { value: numeric })
        : spec.unit === "wpm"
          ? t("units.wpm", { value: numeric })
          : String(numeric);
  const isDefault = numeric === spec.default;

  return (
    <div className="border-b border-border py-3.5 last:border-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-[13.5px] font-bold text-text">
          {label}
        </label>
        <span className="font-num text-[13.5px] font-bold" style={{ color: isDefault ? "var(--color-text-2)" : "var(--color-accent-strong)" }} data-testid={`advanced-value-${spec.key}`}>
          {display}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={spec.min}
        max={max}
        step={spec.step}
        value={Math.min(numeric, max)}
        data-testid={`advanced-param-${spec.key}`}
        onChange={(e) => onChange(spec.key, Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
      <div className="flex justify-between text-[11px] text-text-3">
        <span>{spec.unit === "ms" ? t("units.ms", { value: spec.min }) : spec.min}</span>
        <span>{t("defaultValue", { value: spec.default })}</span>
        <span>{spec.unit === "ms" ? t("units.ms", { value: max }) : max}</span>
      </div>
      {hint ? <div className="mt-1 text-[11.5px] text-text-3">{hint}</div> : null}
    </div>
  );
}

function ExerciseForMethod({
  method,
  settings,
  onComplete,
}: {
  method: AdvancedMethod;
  settings: AdvancedSettings;
  onComplete: (outcome: ExerciseSessionOutcome) => void;
}) {
  const common = { onComplete, exitHref: "/advanced" };
  switch (method) {
    case "adaptive-nback-v0":
      return <NBackExercise {...common} advanced={settings as unknown as NBackAdvanced} />;
    case "complex-span-v0":
      return <ComplexSpanExercise {...common} advanced={settings as unknown as ComplexSpanAdvanced} />;
    case "visuospatial-sequence-recall-v0":
      return <SpatialSequenceExercise {...common} advanced={settings as unknown as SpatialAdvanced} />;
    case "dice-sum-v0":
      return <DiceSumExercise {...common} advanced={settings as unknown as DiceSumAdvanced} />;
    case "reading-paced-adaptive-v0":
      return <PacedReadingExercise {...common} advanced={settings as unknown as ReadingAdvanced} />;
  }
}

export function AdvancedLessonView({
  method,
  initialSettings,
  initialRuns,
}: {
  method: AdvancedMethod;
  initialSettings: AdvancedSettings;
  initialRuns: AdvancedRunView[];
}) {
  const t = useTranslations("advanced");
  const tx = useTranslations("exercise");
  const exerciseName = useExerciseName();
  const [settings, setSettings] = useState<AdvancedSettings>(initialSettings);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [phase, setPhase] = useState<Phase>("configure");
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [runs, setRuns] = useState<AdvancedRunView[]>(initialRuns);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => () => {
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
  }, []);

  async function saveNow(next: AdvancedSettings) {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    setSaveState("saving");
    try {
      await putSettings(method, next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function update(next: AdvancedSettings) {
    const clean = sanitizeAdvancedSettings(method, next);
    setSettings(clean);
    setSaveState("saving");
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => void saveNow(clean), SAVE_DEBOUNCE_MS);
  }

  async function handleStart() {
    if (pendingSaveRef.current) await saveNow(settingsRef.current);
    setResult(null);
    setRunKey((k) => k + 1);
    setPhase("running");
    window.scrollTo({ top: 0 });
  }

  async function handleComplete(outcome: ExerciseSessionOutcome) {
    const lessonSettings = settingsRef.current;
    const summary = summarizeOutcome(method, lessonSettings, outcome);
    let saved = false;
    try {
      const res = await fetch("/api/advanced/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, settings: lessonSettings, ...summary }),
      });
      saved = res.ok;
    } catch {
      saved = false;
    }
    if (saved) {
      setRuns((prev) => [
        { id: `local-${Date.now()}`, method, ...summary, averageWpm: summary.averageWpm ?? null, createdAt: new Date().toISOString() },
        ...prev,
      ].slice(0, 5));
    }
    setResult({ ...summary, saved });
    setPhase("result");
  }

  if (phase === "running") {
    return (
      <div className="flex w-full flex-1 flex-col items-center" data-testid="advanced-running">
        <ExerciseForMethod key={runKey} method={method} settings={settings} onComplete={handleComplete} />
      </div>
    );
  }

  const color = METHOD_COLOR[method];

  if (phase === "result" && result) {
    const pct = result.trialCount > 0 ? Math.round((result.correctCount / result.trialCount) * 100) : 0;
    const isReading = method === "reading-paced-adaptive-v0";
    return (
      <div data-testid="advanced-result" className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7 animate-fade-in-up">
        <div className="mb-6 text-center">
          <h1 className="font-display text-[23px] font-bold text-text">{t("lessonComplete")}</h1>
          <div className="mt-1.5 text-[13.5px] text-text-2">{exerciseName(method)}</div>
        </div>

        <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
          {isReading ? (
            <>
              <div className="text-center">
                <div className="mb-1 text-[11.5px] text-text-3">{t("averageWpm")}</div>
                <div className="font-num text-2xl font-bold text-text">{Math.round(result.averageWpm ?? 0)}</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="mb-1 text-[11.5px] text-text-3">{t("comprehension")}</div>
                <div className="font-num text-2xl font-bold text-text">{pct}%</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-1 text-[11.5px] text-text-3">{tx("accuracy")}</div>
                <div className="font-num text-2xl font-bold text-text">{pct}%</div>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <div className="mb-1 text-[11.5px] text-text-3">{t(`levelName.${method}` as never)}</div>
                <div className="font-num text-2xl font-bold text-text">
                  {result.startLevel} → {result.endLevel}
                </div>
              </div>
            </>
          )}
        </div>

        <p className="mb-2 text-center text-[12.5px] text-text-3">{t("notCounted")}</p>
        {!result.saved ? (
          <p className="mb-2 text-center text-[12.5px]" style={{ color: "var(--color-caution)" }}>
            {t("resultNotSaved")}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2.5 pt-6">
          <button
            type="button"
            onClick={handleStart}
            data-testid="advanced-run-again"
            className="w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
          >
            {t("runAgain")}
          </button>
          <button
            type="button"
            onClick={() => setPhase("configure")}
            className="w-full rounded-full border border-border bg-surface py-3.5 text-center font-body text-[15px] font-bold text-text"
          >
            {t("changeSettings")}
          </button>
          <Link href="/advanced" className="py-2 text-center text-[13.5px] font-semibold text-accent">
            {t("backToAdvanced")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6 md:max-w-[560px]" data-testid="advanced-configure">
      <Link href="/advanced" className="mb-3 text-[13px] font-semibold text-accent">
        {t("back")}
      </Link>
      <div className="mb-1 flex items-center gap-2">
        <div className="h-[7px] w-[7px] rounded-full" style={{ background: `var(--color-${color})` }} aria-hidden="true" />
        <div className="text-[12px] font-bold tracking-wide" style={{ color: `var(--color-${color})` }}>
          {t("tag")}
        </div>
      </div>
      <h1 className="font-display text-[23px] font-bold text-text">{exerciseName(method)}</h1>
      <p className="mb-4 text-[12.5px] text-text-2">{t("notStudied")}</p>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-bold tracking-wide text-text-3">{t("parameters")}</h2>
        <SaveStatus state={saveState} />
      </div>
      <div className="mb-3 rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {ADVANCED_PARAM_SPECS[method].map((spec) => (
          <ParamControl
            key={spec.key}
            method={method}
            spec={spec}
            settings={settings}
            onChange={(key, value) => update({ ...settings, [key]: value })}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => update(defaultAdvancedSettings(method))}
        data-testid="advanced-reset"
        className="mb-5 self-start text-[13px] font-semibold text-accent"
      >
        {t("resetDefaults")}
      </button>

      <button
        type="button"
        onClick={handleStart}
        data-testid="advanced-start"
        className="mb-7 w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent transition-transform active:scale-[0.98]"
      >
        {t("start")}
      </button>

      <h2 className="mb-2.5 text-[12px] font-bold tracking-wide text-text-3">{t("recentRuns")}</h2>
      <AdvancedRunList runs={runs} showMethod={false} />
    </div>
  );
}

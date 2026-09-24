"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SpatialSequenceTask, type SpatialGridSize } from "@lean-academy/cognitive-engine";
import {
  epochOffsetMs,
  perfToEpochMs,
  type SessionModeProps,
  type TrialInput,
  advancedDifficultyBounds,
} from "@/lib/session-types";
import type { PacePreset } from "@/lib/exercise-preferences";
import type { SpatialAdvanced } from "@/lib/advanced-settings";

// Adapted from prototype/ExerciseSpatial.dc.html (a 3x3 grid, cells light
// up in sequence, then the player taps them back in the same order).
// The mockup is a static single moment — the study/recall/feedback phase
// loop is new, following the same structure ComplexSpanExercise already
// established for a multi-round exercise. Same honest-progress principle
// as N-Back/Complex Span: "Sequence N of 5" is real within-exercise
// progress. No visibility-interruption handling is needed here (unlike
// N-Back's per-trial response window) — the study phase is a fixed timed
// reveal with nothing to respond to, and the recall phase has no timeout
// to race against, same as Complex Span's memory-display phase.

const TOTAL_SEQUENCES = 5;
const FEEDBACK_MS = 900;

// Free, opt-in grid-size customization (see apps/web/src/lib/exercise-preferences.ts).
// 9 (3x3) is the standard grid prototype/ExerciseSpatial.dc.html shows;
// 4x4/5x5 give a genuinely bigger board (and, per SpatialSequenceTask's
// own default, a genuinely higher difficulty ceiling) rather than just
// a cosmetic change. Pixel width per grid so cells stay a comfortable
// tap-target size at any size rather than shrinking a fixed 250px board.
const GRID_WIDTH_PX_BY_SIZE: Record<SpatialGridSize, number> = {
  9: 250,
  16: 280,
  25: 320,
};

// Free, opt-in pace customization (see apps/web/src/lib/exercise-preferences.ts).
// STANDARD (800ms display / 300ms gap) is the pace this exercise's
// evidence base was studied at — every other preset is a presentation
// change only, never claimed to carry the same research backing.
const ITEM_DISPLAY_MS_BY_PACE: Record<PacePreset, number> = {
  RELAXED: 1200,
  STANDARD: 800,
  QUICK: 500,
  NO_DELAY: 300,
};
const ITEM_GAP_MS_BY_PACE: Record<PacePreset, number> = {
  RELAXED: 500,
  STANDARD: 300,
  QUICK: 150,
  NO_DELAY: 0,
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

type Phase = "study" | "recall" | "feedback";

interface SequenceSummary {
  sequenceLength: number;
  correctPositions: number;
  fullyCorrect: boolean;
}

interface Results {
  startDifficulty: number;
  endDifficulty: number;
  sequences: SequenceSummary[];
}

interface SpatialSequenceExerciseProps extends SessionModeProps {
  /** Free customization — defaults to STANDARD (the studied pace) when omitted, same as session mode always gets. */
  pace?: PacePreset;
  /** Free customization — defaults to the standard 3x3 (9-cell) grid when omitted, same as session mode always gets. */
  gridSize?: SpatialGridSize;
  /** Advanced-tab lesson parameters (see apps/web/src/lib/advanced-settings.ts) — each overrides the matching constant/preset above. */
  advanced?: SpatialAdvanced;
}

export function SpatialSequenceExercise({ initialDifficulty, onComplete, pace, gridSize, advanced, exitHref = "/" }: SpatialSequenceExerciseProps = {}) {
  const t = useTranslations("spatial");
  const tx = useTranslations("exercise");
  const itemDisplayMs = advanced?.itemDisplayMs ?? ITEM_DISPLAY_MS_BY_PACE[pace ?? "STANDARD"];
  const itemGapMs = advanced?.itemGapMs ?? ITEM_GAP_MS_BY_PACE[pace ?? "STANDARD"];
  const effectiveGridSize: SpatialGridSize = advanced?.gridSize ?? gridSize ?? 9;
  const totalSequences = advanced?.sequences ?? TOTAL_SEQUENCES;
  const feedbackMs = advanced?.feedbackMs ?? FEEDBACK_MS;
  const gridColumns = Math.sqrt(effectiveGridSize);
  const [phase, setPhase] = useState<Phase>("study");
  const [sequenceNumber, setSequenceNumber] = useState(0);
  const [sequenceLength, setSequenceLength] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [sequenceFeedback, setSequenceFeedback] = useState<SequenceSummary | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const recallResolveRef = useRef<(() => void) | null>(null);
  const tappedRef = useRef<number[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const task = new SpatialSequenceTask({
      ...(initialDifficulty !== undefined ? { initialDifficulty } : {}),
      ...advancedDifficultyBounds(advanced),
      gridSize: effectiveGridSize,
    });
    const startDifficulty = task.getCurrentDifficulty();
    const sequences: SequenceSummary[] = [];
    const offsetMs = epochOffsetMs();
    const trials: TrialInput[] = [];

    async function waitForRecallSubmit(): Promise<void> {
      await new Promise<void>((resolve) => {
        recallResolveRef.current = resolve;
      });
    }

    async function run() {
      for (let s = 0; s < totalSequences; s++) {
        if (controller.signal.aborted) return;

        const sequenceStartedAt = performance.now();
        task.startSequence();
        const length = task.getCurrentSequenceLength();
        setSequenceNumber(s + 1);
        setSequenceLength(length);
        setTapped([]);
        tappedRef.current = [];

        setPhase("study");
        for (let i = 0; i < length; i++) {
          if (controller.signal.aborted) return;
          const position = task.nextSequenceItem();
          setHighlighted(position);
          await sleep(itemDisplayMs, controller.signal);
          if (controller.signal.aborted) return;
          setHighlighted(null);
          await sleep(itemGapMs, controller.signal);
          if (controller.signal.aborted) return;
        }

        setPhase("recall");
        await waitForRecallSubmit();
        if (controller.signal.aborted) return;

        const respondedAt = performance.now();
        const outcome = task.submitRecall(tappedRef.current, {
          timestamp: respondedAt,
        });
        const summary: SequenceSummary = {
          sequenceLength: outcome.sequenceLength,
          correctPositions: outcome.correctPositions,
          fullyCorrect: outcome.fullyCorrect,
        };
        sequences.push(summary);
        trials.push({
          correct: outcome.fullyCorrect,
          stimulusStartedAtMs: perfToEpochMs(sequenceStartedAt, offsetMs),
          respondedAtMs: perfToEpochMs(respondedAt, offsetMs),
          wasInterrupted: false,
          difficultyAtTrial: outcome.sequenceLength,
          metadata: { correctPositions: outcome.correctPositions },
        });
        setSequenceFeedback(summary);
        setPhase("feedback");
        await sleep(feedbackMs, controller.signal);
        if (controller.signal.aborted) return;
      }

      const endDifficulty = task.getCurrentDifficulty();
      if (onComplete) {
        onComplete({
          method: "visuospatial-sequence-recall-v0",
          startDifficulty,
          endDifficulty,
          trials,
          summaryLabel: tx("levelSummary", { start: startDifficulty, end: endDifficulty }),
        });
        return;
      }
      setResults({
        startDifficulty,
        endDifficulty,
        sequences,
      });
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap(position: number) {
    if (phase !== "recall" || sequenceLength === null) return;
    if (tappedRef.current.includes(position)) {
      // Tapping an already-selected square deselects just that one,
      // shifting later taps' order numbers down — not only undoable via
      // the separate Undo button (which only ever removes the last tap).
      tappedRef.current = tappedRef.current.filter((p) => p !== position);
      setTapped(tappedRef.current);
      return;
    }
    if (tappedRef.current.length >= sequenceLength) return;
    tappedRef.current = [...tappedRef.current, position];
    setTapped(tappedRef.current);
  }

  function handleUndo() {
    tappedRef.current = tappedRef.current.slice(0, -1);
    setTapped(tappedRef.current);
  }

  function handleSubmit() {
    recallResolveRef.current?.();
    recallResolveRef.current = null;
  }

  if (results) {
    return <SpatialSequenceResults results={results} />;
  }

  return (
    <div
      className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5"
      data-testid="spatial-sequence-exercise"
      data-pace={pace ?? "STANDARD"}
      data-grid-size={effectiveGridSize}
    >
      <div className="mb-2 flex items-center justify-between">
        <Link href={exitHref} aria-label={tx("exit")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="mx-4 h-1 flex-1 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-spatial transition-all"
            style={{ width: `${(sequenceNumber / totalSequences) * 100}%` }}
          />
        </div>
        <div className="w-[18px]" />
      </div>
      <div className="mb-4 text-center text-xs text-text-3">
        {t("sequenceOf", { current: sequenceNumber, total: totalSequences })}
      </div>

      <h1 className="sr-only">{t("srTitle")}</h1>
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-spatial" />
        <div className="text-[12.5px] font-bold tracking-wide text-spatial">
          {t("tag")}
        </div>
      </div>

      <div className="mb-8 text-center font-display text-lg font-bold text-text">
        {phase === "study"
          ? t("watch")
          : phase === "feedback"
            ? sequenceFeedback?.fullyCorrect
              ? t("perfectRecall")
              : t("rightOrder", {
                  correct: sequenceFeedback?.correctPositions ?? 0,
                  total: sequenceFeedback?.sequenceLength ?? sequenceLength ?? 0,
                })
            : t("tapOrder")}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div data-testid="highlighted-cell" className="hidden">
          {highlighted !== null ? highlighted : ""}
        </div>
        <div
          className="mb-6 grid gap-3.5"
          style={{ width: `${GRID_WIDTH_PX_BY_SIZE[effectiveGridSize]}px`, gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: effectiveGridSize }, (_, i) => {
            const isHighlighted = phase === "study" && highlighted === i;
            const tapOrder = tapped.indexOf(i);
            return (
              <button
                key={i}
                type="button"
                data-testid={`grid-cell-${i}`}
                aria-label={isHighlighted ? t("cellLit", { n: i + 1 }) : t("cell", { n: i + 1 })}
                onClick={() => handleTap(i)}
                disabled={phase !== "recall"}
                className="flex aspect-square items-center justify-center rounded-md border-[1.5px] font-num text-base font-bold transition-transform duration-micro active:scale-90 disabled:active:scale-100"
                style={{
                  background: isHighlighted || tapOrder >= 0 ? "var(--color-spatial)" : "var(--color-surface-2)",
                  borderColor: isHighlighted || tapOrder >= 0 ? "var(--color-spatial)" : "var(--color-border)",
                  color: "var(--color-on-accent)",
                }}
              >
                {tapOrder >= 0 ? tapOrder + 1 : ""}
              </button>
            );
          })}
        </div>

        {phase === "recall" && sequenceLength !== null && (
          <div className="flex w-full gap-3">
            <button
              data-testid="recall-undo"
              onClick={handleUndo}
              disabled={tapped.length === 0}
              className="flex-1 rounded-full border-[1.5px] border-border py-3 font-body text-sm font-bold text-text-2 transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {t("undo")}
            </button>
            <button
              data-testid="recall-submit"
              onClick={handleSubmit}
              disabled={tapped.length !== sequenceLength}
              className="flex-1 rounded-full bg-accent py-3 font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {t("submit")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpatialSequenceResults({ results }: { results: Results }) {
  const t = useTranslations("spatial");
  const tx = useTranslations("exercise");
  const { startDifficulty, endDifficulty, sequences } = results;
  const perfectSequences = sequences.filter((s) => s.fullyCorrect).length;

  let note: string;
  if (endDifficulty > startDifficulty) {
    note = t("noteUp");
  } else if (endDifficulty < startDifficulty) {
    note = t("noteDown");
  } else {
    note = t("noteSteady", { rounds: sequences.length });
  }

  const lengthIncreased = endDifficulty > startDifficulty;

  return (
    <div data-testid="results-screen" className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7 animate-fade-in-up">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-[23px] font-bold text-text">{tx("complete")}</h1>
        <div className="mt-1.5 text-[13.5px] text-text-2">{t("name")}</div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{t("perfectSequences")}</div>
          <div className="font-num text-2xl font-bold text-text">
            {perfectSequences}/{sequences.length}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{t("sequenceLength")}</div>
          <div className={`font-num text-2xl font-bold text-text ${lengthIncreased ? "animate-celebration-pop" : ""}`}>
            {startDifficulty} → {endDifficulty}
          </div>
        </div>
      </div>

      <div className="mb-auto rounded-lg border border-border bg-surface p-4.5">
        <p className="text-[13.5px] leading-relaxed text-text-2">{note}</p>
      </div>

      <Link
        href="/"
        className="mt-6 block w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
      >
        {tx("done")}
      </Link>
    </div>
  );
}

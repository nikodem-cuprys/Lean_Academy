"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  BackwardSpatialSpanAssessment as BackwardSpatialSpanEngine,
  type BackwardSpatialSpanScore,
} from "@lean-academy/cognitive-engine";

// The SPATIAL-domain twin of BackwardDigitSpanAssessment.tsx — same
// staircase-driving structure, same periodic-status intro/results
// shape. The grid study/recall UI is adapted from
// SpatialSequenceExercise.tsx (prototype/ExerciseSpatial.dc.html)
// rather than invented fresh: same "highlighted-cell" test id for the
// study phase and "grid-cell-N"/tap-order-number recall interaction —
// but recall here asks for the sequence back in *reverse* order, the
// genuine near-transfer difference from the trained (forward-recall)
// exercise. This is a periodic *assessment*, not a trainable exercise
// — no daily-session wiring, no adaptive engine, and no fixed trial
// count. See docs/kanban.md's "Near-transfer assessment: alternate
// spatial-span variant" card.

const GRID_SIZE = 9;
const ITEM_DISPLAY_MS = 800;
const ITEM_GAP_MS = 300;
const FEEDBACK_MS = 1100;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

type Phase = "intro" | "study" | "recall" | "feedback" | "submitting" | "done" | "error";

export interface BackwardSpatialSpanStatusProps {
  lastTakenAt: string | null;
  isDue: boolean;
  nextDueAt: string | null;
}

export function BackwardSpatialSpanAssessment({ status }: { status: BackwardSpatialSpanStatusProps }) {
  const t = useTranslations("spatialSpan");
  const ta = useTranslations("assessment");
  const tc = useTranslations("common");
  const ts = useTranslations("spatial");
  const [phase, setPhase] = useState<Phase>("intro");
  const [span, setSpan] = useState<number>(0);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{ correct: boolean; expectedResponse: number[] } | null>(null);
  const [score, setScore] = useState<BackwardSpatialSpanScore | null>(null);

  const tappedRef = useRef<number[]>([]);
  const recallResolveRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();
    const engine = new BackwardSpatialSpanEngine();

    async function waitForRecallSubmit(): Promise<void> {
      return new Promise((resolve) => {
        recallResolveRef.current = resolve;
      });
    }

    async function run() {
      while (!engine.isComplete()) {
        if (controller.signal.aborted) return;

        setSpan(engine.getCurrentSpan());
        const positions = engine.nextTrialPositions();

        setPhase("study");
        tappedRef.current = [];
        setTapped([]);
        for (const position of positions) {
          if (controller.signal.aborted) return;
          setHighlighted(position);
          await sleep(ITEM_DISPLAY_MS, controller.signal);
          setHighlighted(null);
          await sleep(ITEM_GAP_MS, controller.signal);
        }
        if (controller.signal.aborted) return;

        setPhase("recall");
        await waitForRecallSubmit();
        if (controller.signal.aborted) return;

        const outcome = engine.submitRecall(tappedRef.current);
        setLastOutcome({ correct: outcome.correct, expectedResponse: outcome.expectedResponse });
        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      const finalScore = engine.getScore();
      setScore(finalScore);
      setPhase("submitting");

      try {
        const res = await fetch("/api/assessments/backward-spatial-span", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalScore),
        });
        if (!res.ok) throw new Error("Save failed");
      } catch {
        setPhase("error");
        return;
      }
      setPhase("done");
    }

    run();
  }

  useEffect(() => {
    return () => {
      recallResolveRef.current = null;
    };
  }, []);

  function handleTap(position: number) {
    if (tappedRef.current.includes(position)) return;
    if (tappedRef.current.length >= span) return;
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

  if (phase === "intro") {
    return <IntroScreen status={status} onStart={start} />;
  }
  if (phase === "done" && score) {
    return <ResultsScreen score={score} />;
  }
  if (phase === "error") {
    return (
      <div className="flex w-full max-w-[390px] flex-1 flex-col items-center justify-center gap-4 px-6 py-7 text-center">
        <p className="text-[13.5px] text-text-2">
          {ta("saveError")}
        </p>
        <Link href="/" className="rounded-full bg-accent px-6 py-3 font-body text-[15px] font-bold text-on-accent">
          {tc("backHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label={ta("exit")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div />
        <div className="w-[18px]" />
      </div>
      <div className="mb-4 text-center text-xs text-text-3">{ta("spanLength", { span })}</div>

      <h1 className="sr-only">{t("srTitle")}</h1>
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-spatial" />
        <div className="text-[12.5px] font-bold tracking-wide text-spatial">
          {t("tag")}
        </div>
      </div>

      <div className="mb-8 text-center font-display text-lg font-bold text-text">
        {phase === "study"
          ? ts("watch")
          : phase === "feedback"
            ? lastOutcome?.correct
              ? ta("correct")
              : ta("notQuite")
            : t("tapReverse")}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div data-testid="highlighted-cell" className="hidden">
          {highlighted !== null ? highlighted : ""}
        </div>
        <div className="mb-6 grid w-[250px] grid-cols-3 gap-3.5">
          {Array.from({ length: GRID_SIZE }, (_, i) => {
            const isHighlighted = phase === "study" && highlighted === i;
            const tapOrder = tapped.indexOf(i);
            return (
              <button
                key={i}
                type="button"
                data-testid={`grid-cell-${i}`}
                aria-label={isHighlighted ? ts("cellLit", { n: i + 1 }) : ts("cell", { n: i + 1 })}
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

        {phase === "feedback" && !lastOutcome?.correct && (
          <div className="mb-4 text-center text-[12.5px] text-text-3">
            Correct order was cells: {lastOutcome?.expectedResponse.map((p) => p + 1).join(" – ")}
          </div>
        )}

        {phase === "recall" && (
          <div className="flex w-full gap-3">
            <button
              data-testid="recall-undo"
              onClick={handleUndo}
              disabled={tapped.length === 0}
              className="flex-1 rounded-full border-[1.5px] border-border py-3 font-body text-sm font-bold text-text-2 transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {ts("undo")}
            </button>
            <button
              data-testid="recall-submit"
              onClick={handleSubmit}
              disabled={tapped.length !== span}
              className="flex-1 rounded-full bg-accent py-3 font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {ta("submit")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function IntroScreen({ status, onStart }: { status: BackwardSpatialSpanStatusProps; onStart: () => void }) {
  const t = useTranslations("spatialSpan");
  const ta = useTranslations("assessment");
  const format = useFormatter();
  const lastTaken = status.lastTakenAt ? new Date(status.lastTakenAt) : null;
  const nextDue = status.nextDueAt ? new Date(status.nextDueAt) : null;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <Link href="/" aria-label={ta("exit")} className="mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </Link>
      <h1 className="mb-2 font-display text-[21px] font-bold text-text">{t("name")}</h1>
      <p className="mb-4 text-[13.5px] leading-relaxed text-text-2">
        {t.rich("intro", { strong: (chunks) => <strong>{chunks}</strong> })}
      </p>
      <p className="mb-4 text-[13.5px] leading-relaxed text-text-2">{t("disclaimer")}</p>
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-[12.5px] text-text-3" data-testid="assessment-status">
        {lastTaken ? (
          <>
            {ta("lastTaken", { date: format.dateTime(lastTaken) })}{" "}
            {status.isDue
              ? ta("due")
              : ta("nextDue", { date: nextDue ? format.dateTime(nextDue) : "" })}
          </>
        ) : (
          ta("neverTaken")
        )}{" "}
        {ta("anyTime")}
      </div>
      <button
        onClick={onStart}
        data-testid="start-assessment"
        className="mt-auto w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
      >
        {ta("start")}
      </button>
    </div>
  );
}

function ResultsScreen({ score }: { score: BackwardSpatialSpanScore }) {
  const t = useTranslations("spatialSpan");
  const ta = useTranslations("assessment");
  const { finalSpan, totalCorrect, totalTrials, finalSpanCorrect, finalSpanTrials } = score;

  return (
    <div data-testid="results-screen" className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7 animate-fade-in-up">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-[23px] font-bold text-text">{ta("complete")}</h1>
        <div className="mt-1.5 text-[13.5px] text-text-2">{t("name")}</div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{ta("backwardSpan")}</div>
          <div className="font-num text-2xl font-bold text-text" data-testid="final-span">
            {finalSpan}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{ta("atThatLength")}</div>
          <div className="font-num text-2xl font-bold text-text">
            {finalSpanCorrect}/{finalSpanTrials}
          </div>
        </div>
      </div>

      <div className="mb-auto rounded-lg border border-border bg-surface p-4.5">
        <p className="text-[13.5px] leading-relaxed text-text-2">
          {t("resultNote", { correct: totalCorrect, total: totalTrials })}
        </p>
      </div>

      <Link href="/" className="mt-6 block w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent">
        {ta("done")}
      </Link>
    </div>
  );
}

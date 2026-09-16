"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BackwardDigitSpanAssessment as BackwardDigitSpanEngine,
  type BackwardDigitSpanScore,
} from "@lean-academy/cognitive-engine";

// Adapted from prototype/ExerciseDigitSpan.dc.html's numpad recall UI
// (the mockup only shows recall entry, not the study/memorize moment —
// that's new here, following the study-phase pacing pattern already
// established by ComplexSpanExercise/SpatialSequenceExercise: one item
// shown at a time, not the whole sequence at once). This is a periodic
// *assessment*, not a trainable exercise — no daily-session wiring,
// no adaptive engine, and no fixed trial count: the fixed ascending
// staircase (packages/cognitive-engine's BackwardDigitSpanAssessment)
// decides on its own when it's done. See docs/kanban.md's "Near-transfer
// assessment: Backward Digit Span" card.

const DIGIT_DISPLAY_MS = 900;
const DIGIT_GAP_MS = 250;
const FEEDBACK_MS = 1100;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

type Phase = "intro" | "study" | "recall" | "feedback" | "submitting" | "done" | "error";

export interface BackwardDigitSpanStatusProps {
  lastTakenAt: string | null;
  isDue: boolean;
  nextDueAt: string | null;
}

export function BackwardDigitSpanAssessment({ status }: { status: BackwardDigitSpanStatusProps }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [span, setSpan] = useState<number>(0);
  const [studyDigit, setStudyDigit] = useState<number | null>(null);
  const [recalled, setRecalled] = useState<number[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{ correct: boolean; expectedResponse: number[] } | null>(null);
  const [score, setScore] = useState<BackwardDigitSpanScore | null>(null);

  const recalledRef = useRef<number[]>([]);
  const recallResolveRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();
    const engine = new BackwardDigitSpanEngine();

    async function waitForRecallSubmit(): Promise<void> {
      return new Promise((resolve) => {
        recallResolveRef.current = resolve;
      });
    }

    async function run() {
      while (!engine.isComplete()) {
        if (controller.signal.aborted) return;

        setSpan(engine.getCurrentSpan());
        const digits = engine.nextTrialDigits();

        setPhase("study");
        recalledRef.current = [];
        setRecalled([]);
        for (const digit of digits) {
          if (controller.signal.aborted) return;
          setStudyDigit(digit);
          await sleep(DIGIT_DISPLAY_MS, controller.signal);
          setStudyDigit(null);
          await sleep(DIGIT_GAP_MS, controller.signal);
        }
        if (controller.signal.aborted) return;

        setPhase("recall");
        await waitForRecallSubmit();
        if (controller.signal.aborted) return;

        const outcome = engine.submitRecall(recalledRef.current);
        setLastOutcome({ correct: outcome.correct, expectedResponse: outcome.expectedResponse });
        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      const finalScore = engine.getScore();
      setScore(finalScore);
      setPhase("submitting");

      try {
        const res = await fetch("/api/assessments/backward-digit-span", {
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

  function handleDigitTap(d: number) {
    if (recalledRef.current.length >= span) return;
    recalledRef.current = [...recalledRef.current, d];
    setRecalled(recalledRef.current);
  }

  function handleBackspace() {
    recalledRef.current = recalledRef.current.slice(0, -1);
    setRecalled(recalledRef.current);
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
          Something went wrong saving your result. Please try again.
        </p>
        <Link href="/" className="rounded-full bg-accent px-6 py-3 font-body text-[15px] font-bold text-on-accent">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label="Exit assessment">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div />
        <div className="w-[18px]" />
      </div>
      <div className="mb-5 text-center text-xs text-text-3">
        Span length {span}
      </div>

      <h1 className="sr-only">Backward Digit Span assessment</h1>
      <div className="mb-2.5 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-wm" />
        <div className="text-[12.5px] font-bold tracking-wide text-wm">
          WORKING MEMORY · BACKWARD DIGIT SPAN
        </div>
      </div>

      {phase === "study" && (
        <>
          <div className="mb-8 text-center font-display text-[19px] font-bold text-text">
            Watch the numbers
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div
              data-testid="study-digit"
              className="font-num text-6xl font-bold text-wm"
            >
              {studyDigit ?? ""}
            </div>
          </div>
        </>
      )}

      {(phase === "recall" || phase === "feedback" || phase === "submitting") && (
        <>
          <div className="mb-4 text-center font-display text-[19px] font-bold text-text">
            {phase === "feedback"
              ? lastOutcome?.correct
                ? "Correct"
                : "Not quite"
              : "Enter the numbers, in reverse order"}
          </div>
          <div className="mb-8 flex flex-wrap justify-center gap-2.5">
            {Array.from({ length: span }, (_, i) => (
              <div
                key={i}
                data-testid={`recall-slot-${i}`}
                className="flex h-[52px] w-[42px] items-center justify-center rounded-md border-[1.5px] font-num text-xl font-bold"
                style={{
                  borderColor: recalled[i] !== undefined ? "var(--color-wm)" : "var(--color-border)",
                  background: recalled[i] !== undefined ? "var(--color-wm-soft)" : "var(--color-surface)",
                  color: "var(--color-wm)",
                }}
              >
                {recalled[i] ?? ""}
              </div>
            ))}
          </div>

          {phase === "feedback" && !lastOutcome?.correct && (
            <div className="mb-6 text-center text-[12.5px] text-text-3">
              Correct order was: {lastOutcome?.expectedResponse.join(" – ")}
            </div>
          )}

          {phase === "recall" && (
            <>
              <div className="flex-1" />
              <div className="mb-3.5 grid grid-cols-3 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    data-testid={`digit-key-${n}`}
                    onClick={() => handleDigitTap(n)}
                    disabled={recalled.length >= span}
                    className="aspect-square rounded-[14px] border border-border bg-surface font-num text-lg font-bold text-text"
                  >
                    {n}
                  </button>
                ))}
                <button
                  data-testid="digit-backspace"
                  onClick={handleBackspace}
                  disabled={recalled.length === 0}
                  className="aspect-square rounded-[14px] border border-border bg-surface text-sm text-text-2"
                >
                  ⌫
                </button>
                <button
                  data-testid="digit-key-0"
                  onClick={() => handleDigitTap(0)}
                  disabled={recalled.length >= span}
                  className="aspect-square rounded-[14px] border border-border bg-surface font-num text-lg font-bold text-text"
                >
                  0
                </button>
                <div />
              </div>
              <button
                data-testid="recall-submit"
                onClick={handleSubmit}
                disabled={recalled.length !== span}
                className="w-full rounded-full py-3.5 text-center font-body text-[15px] font-bold text-on-accent disabled:opacity-40"
                style={{ background: "var(--color-wm)" }}
              >
                Submit
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function IntroScreen({ status, onStart }: { status: BackwardDigitSpanStatusProps; onStart: () => void }) {
  const lastTaken = status.lastTakenAt ? new Date(status.lastTakenAt) : null;
  const nextDue = status.nextDueAt ? new Date(status.nextDueAt) : null;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <Link href="/" aria-label="Exit assessment" className="mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </Link>
      <h1 className="mb-2 font-display text-[21px] font-bold text-text">Backward Digit Span</h1>
      <p className="mb-4 text-[13.5px] leading-relaxed text-text-2">
        A short, different-shaped task from your trained exercises: you&rsquo;ll see a sequence of digits, then
        enter them back in <strong>reverse</strong> order. The sequence gets longer as you succeed and stops after
        two misses in a row.
      </p>
      <p className="mb-4 text-[13.5px] leading-relaxed text-text-2">
        This measures a near-transfer working-memory outcome sharing structure with your trained tasks — it does
        not measure IQ, general intelligence, or everyday memory.
      </p>
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-[12.5px] text-text-3" data-testid="assessment-status">
        {lastTaken ? (
          <>
            Last taken {lastTaken.toLocaleDateString()}.{" "}
            {status.isDue
              ? "It's been a while — a fresh measurement is due."
              : `Measured periodically, not every session — next recommended around ${nextDue?.toLocaleDateString()}.`}
          </>
        ) : (
          "You haven't taken this assessment yet."
        )}{" "}
        You can take it any time.
      </div>
      <button
        onClick={onStart}
        data-testid="start-assessment"
        className="mt-auto w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
      >
        Start
      </button>
    </div>
  );
}

function ResultsScreen({ score }: { score: BackwardDigitSpanScore }) {
  const { finalSpan, totalCorrect, totalTrials, finalSpanCorrect, finalSpanTrials } = score;

  return (
    <div data-testid="results-screen" className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7 animate-fade-in-up">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-[23px] font-bold text-text">Assessment complete</h1>
        <div className="mt-1.5 text-[13.5px] text-text-2">Backward Digit Span</div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">BACKWARD SPAN</div>
          <div className="font-num text-2xl font-bold text-text" data-testid="final-span">
            {finalSpan}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">AT THAT LENGTH</div>
          <div className="font-num text-2xl font-bold text-text">
            {finalSpanCorrect}/{finalSpanTrials}
          </div>
        </div>
      </div>

      <div className="mb-auto rounded-lg border border-border bg-surface p-4.5">
        <p className="text-[13.5px] leading-relaxed text-text-2">
          Across the whole run you recalled {totalCorrect} of {totalTrials} sequences correctly. This is a
          near-transfer measure — a genuinely different task from your trained exercises that shares their
          working-memory span structure. It doesn&rsquo;t measure IQ, general intelligence, or everyday memory,
          and results at a single length from a handful of trials carry real uncertainty.
        </p>
      </div>

      <Link href="/" className="mt-6 block w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent">
        Done
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ComplexSpanTask,
  type ProcessingItem,
} from "@lean-academy/cognitive-engine";
import {
  epochOffsetMs,
  perfToEpochMs,
  type SessionModeProps,
  type TrialInput,
} from "@/lib/session-types";

// Adapted from prototype/ExerciseComplexSpan.dc.html, which only shows
// one representative moment (the processing step) — the recall UI is
// new, since the mockup didn't cover it. It reuses the tap-button
// pattern from prototype/ExerciseDigitSpan.dc.html's numpad for
// consistency with an established interaction rather than inventing a
// third pattern. Same honest-progress principle as the N-Back screen:
// "Set N of 5" is real within-exercise progress, not a fabricated
// multi-exercise session indicator.

const TOTAL_SETS = 5;
const PROCESSING_MS = 6000;
const MEMORY_DISPLAY_MS = 1200;
const FEEDBACK_MS = 900;

const RECALL_LETTERS = [
  "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
];

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

type Phase = "processing" | "memory" | "recall" | "feedback";

interface SetSummary {
  setSize: number;
  correctPositions: number;
  fullyCorrect: boolean;
}

interface Results {
  startDifficulty: number;
  endDifficulty: number;
  sets: SetSummary[];
  processingAccuracy: { correct: number; total: number };
}

export function ComplexSpanExercise({ initialDifficulty, onComplete }: SessionModeProps = {}) {
  const [phase, setPhase] = useState<Phase>("processing");
  const [setNumber, setSetNumber] = useState(0);
  const [setSize, setSetSize] = useState<number | null>(null);
  const [shownLetters, setShownLetters] = useState<string[]>([]);
  const [processingItem, setProcessingItem] = useState<ProcessingItem | null>(null);
  const [memoryLetter, setMemoryLetter] = useState<string | null>(null);
  const [recalled, setRecalled] = useState<string[]>([]);
  const [setFeedback, setSetFeedback] = useState<SetSummary | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const respondRef = useRef<((said: boolean) => void) | null>(null);
  const recallResolveRef = useRef<(() => void) | null>(null);
  const recalledRef = useRef<string[]>([]);
  const visibleRef = useRef(true);

  useEffect(() => {
    const onVisibility = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const task = new ComplexSpanTask(initialDifficulty !== undefined ? { initialDifficulty } : {});
    const startDifficulty = task.getCurrentDifficulty();
    const sets: SetSummary[] = [];
    const offsetMs = epochOffsetMs();
    const trials: TrialInput[] = [];

    async function waitForTrueFalse(): Promise<{ said: boolean; interrupted: boolean }> {
      let interrupted = !visibleRef.current;
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = (said: boolean) => {
          if (settled) return;
          settled = true;
          respondRef.current = null;
          clearTimeout(timer);
          document.removeEventListener("visibilitychange", onVis);
          lastAnswer = said;
          resolve();
        };
        const onVis = () => {
          if (document.visibilityState !== "visible") interrupted = true;
        };
        document.addEventListener("visibilitychange", onVis);
        respondRef.current = finish;
        const timer = setTimeout(() => finish(false), PROCESSING_MS);
      });
      return { said: lastAnswer, interrupted };
    }
    let lastAnswer = false;

    async function waitForRecallSubmit(): Promise<void> {
      await new Promise<void>((resolve) => {
        recallResolveRef.current = resolve;
      });
    }

    async function run() {
      for (let s = 0; s < TOTAL_SETS; s++) {
        if (controller.signal.aborted) return;

        const setStartedAt = performance.now();
        task.startSet();
        const size = task.getCurrentSetSize();
        setSetNumber(s + 1);
        setSetSize(size);
        setShownLetters([]);
        setRecalled([]);
        recalledRef.current = [];

        for (let i = 0; i < size; i++) {
          if (controller.signal.aborted) return;

          setPhase("processing");
          const item = task.nextProcessingItem();
          setProcessingItem(item);
          const { said, interrupted } = await waitForTrueFalse();
          if (!interrupted) task.recordProcessingResponse(said, item);

          if (controller.signal.aborted) return;
          setPhase("memory");
          const letter = task.nextMemoryItem();
          setMemoryLetter(letter);
          setShownLetters((prev) => [...prev, letter]);
          await sleep(MEMORY_DISPLAY_MS, controller.signal);
          if (controller.signal.aborted) return;
        }

        setPhase("recall");
        await waitForRecallSubmit();
        if (controller.signal.aborted) return;

        const respondedAt = performance.now();
        const outcome = task.submitRecall(recalledRef.current, {
          timestamp: respondedAt,
        });
        const summary: SetSummary = {
          setSize: outcome.setSize,
          correctPositions: outcome.correctPositions,
          fullyCorrect: outcome.fullyCorrect,
        };
        sets.push(summary);
        trials.push({
          correct: outcome.fullyCorrect,
          stimulusStartedAtMs: perfToEpochMs(setStartedAt, offsetMs),
          respondedAtMs: perfToEpochMs(respondedAt, offsetMs),
          wasInterrupted: false,
          difficultyAtTrial: outcome.setSize,
          metadata: { correctPositions: outcome.correctPositions },
        });
        setSetFeedback(summary);
        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      const endDifficulty = task.getCurrentDifficulty();
      if (onComplete) {
        onComplete({
          method: "complex-span-v0",
          startDifficulty,
          endDifficulty,
          trials,
          summaryLabel: `Span ${startDifficulty} → ${endDifficulty}`,
        });
        return;
      }
      setResults({
        startDifficulty,
        endDifficulty,
        sets,
        processingAccuracy: task.getProcessingAccuracy(),
      });
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTrueFalse(said: boolean) {
    respondRef.current?.(said);
  }

  function handleRecallTap(letter: string) {
    if (setSize === null || recalledRef.current.length >= setSize) return;
    recalledRef.current = [...recalledRef.current, letter];
    setRecalled(recalledRef.current);
  }

  function handleRecallUndo() {
    recalledRef.current = recalledRef.current.slice(0, -1);
    setRecalled(recalledRef.current);
  }

  function handleRecallSubmit() {
    recallResolveRef.current?.();
    recallResolveRef.current = null;
  }

  if (results) {
    return <ComplexSpanResults results={results} />;
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label="Exit exercise">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="mx-4 h-1 flex-1 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-wm transition-all"
            style={{ width: `${(setNumber / TOTAL_SETS) * 100}%` }}
          />
        </div>
        <div className="w-[18px]" />
      </div>
      <div className="mb-4 text-center text-xs text-text-3">
        Set {setNumber} of {TOTAL_SETS}
      </div>

      <h1 className="sr-only">Complex Span exercise</h1>
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-wm" />
        <div className="text-[12.5px] font-bold tracking-wide text-wm">
          WORKING MEMORY · COMPLEX SPAN
        </div>
      </div>

      <div className="mb-1.5 text-center text-[12.5px] text-text-3">
        Hold onto the letters — you&rsquo;ll recall them after
      </div>
      <div className="mb-8 flex justify-center gap-2.5">
        {Array.from({ length: setSize ?? 0 }, (_, i) => {
          const letter = shownLetters[i];
          return (
            <div
              key={i}
              data-testid="letter-chip"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] font-num text-base font-bold"
              style={
                letter
                  ? { background: "var(--color-wm-soft)", color: "var(--color-wm)" }
                  : {
                      background: "var(--color-surface-2)",
                      color: "var(--color-text-3)",
                      border: "1.5px dashed var(--color-border)",
                    }
              }
            >
              {letter ?? "?"}
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {phase === "processing" && processingItem && (
          <>
            <div className="mb-2.5 text-[13px] text-text-3">Is this true?</div>
            <div className="mb-8 font-num text-4xl font-bold text-text">
              {processingItem.a} {processingItem.operator} {processingItem.b} ={" "}
              {processingItem.displayedResult}
            </div>
            <div className="flex w-full gap-3">
              <button
                data-testid="true-button"
                onClick={() => handleTrueFalse(true)}
                className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-4 text-center font-body text-[15px] font-bold text-text transition-transform duration-micro active:scale-95"
              >
                True
              </button>
              <button
                data-testid="false-button"
                onClick={() => handleTrueFalse(false)}
                className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-4 text-center font-body text-[15px] font-bold text-text transition-transform duration-micro active:scale-95"
              >
                False
              </button>
            </div>
          </>
        )}

        {phase === "memory" && memoryLetter && (
          <div
            data-testid="memory-letter"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-wm font-num text-4xl font-bold text-on-accent"
          >
            {memoryLetter}
          </div>
        )}

        {(phase === "recall" || phase === "feedback") && setSize !== null && (
          <div className="w-full">
            <div className="mb-4 text-center font-display text-lg font-bold text-text">
              {phase === "feedback"
                ? setFeedback?.fullyCorrect
                  ? "Perfect recall"
                  : `${setFeedback?.correctPositions ?? 0} of ${setFeedback?.setSize ?? setSize} in the right spot`
                : "Tap the letters, in order"}
            </div>
            <div className="mb-5 flex justify-center gap-2">
              {Array.from({ length: setSize }, (_, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] font-num text-sm font-bold"
                  style={{
                    borderColor: recalled[i] ? "var(--color-wm)" : "var(--color-border)",
                    background: recalled[i] ? "var(--color-wm-soft)" : "transparent",
                    color: "var(--color-text)",
                  }}
                >
                  {recalled[i] ?? ""}
                </div>
              ))}
            </div>
            {phase === "recall" && (
              <>
                <div className="mb-3 grid grid-cols-7 gap-1.5">
                  {RECALL_LETTERS.map((letter) => (
                    <button
                      key={letter}
                      data-testid={`recall-key-${letter}`}
                      onClick={() => handleRecallTap(letter)}
                      disabled={recalled.length >= setSize}
                      className="rounded-md border border-border bg-surface py-2 font-num text-sm font-bold text-text transition-transform duration-micro active:scale-90 disabled:opacity-40 disabled:active:scale-100"
                    >
                      {letter}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <button
                    data-testid="recall-undo"
                    onClick={handleRecallUndo}
                    disabled={recalled.length === 0}
                    className="flex-1 rounded-full border-[1.5px] border-border py-3 font-body text-sm font-bold text-text-2 transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                  >
                    Undo
                  </button>
                  <button
                    data-testid="recall-submit"
                    onClick={handleRecallSubmit}
                    disabled={recalled.length !== setSize}
                    className="flex-1 rounded-full bg-accent py-3 font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ComplexSpanResults({ results }: { results: Results }) {
  const { startDifficulty, endDifficulty, sets, processingAccuracy } = results;
  const perfectSets = sets.filter((s) => s.fullyCorrect).length;
  const processingPct =
    processingAccuracy.total > 0
      ? Math.round((processingAccuracy.correct / processingAccuracy.total) * 100)
      : 0;

  let note: string;
  if (endDifficulty > startDifficulty) {
    note = `You recalled full sequences accurately enough that the span increased — that's the sign to keep going.`;
  } else if (endDifficulty < startDifficulty) {
    note = `Span length eased back a notch to keep this challenging but doable. That's the adaptive engine working as intended, not a setback.`;
  } else {
    note = `You held steady at this span length across ${sets.length} sets.`;
  }

  const spanIncreased = endDifficulty > startDifficulty;

  return (
    <div data-testid="results-screen" className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7 animate-fade-in-up">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="font-display text-[23px] font-bold text-text">Exercise complete</h1>
        <div className="mt-1.5 text-[13.5px] text-text-2">Complex Span</div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">PERFECT SETS</div>
          <div className="font-num text-2xl font-bold text-text">
            {perfectSets}/{sets.length}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">SPAN</div>
          <div className={`font-num text-2xl font-bold text-text ${spanIncreased ? "animate-celebration-pop" : ""}`}>
            {startDifficulty} → {endDifficulty}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4.5">
        <div className="mb-1 text-[11.5px] text-text-3">
          PROCESSING ACCURACY (the true/false checks)
        </div>
        <div className="font-num text-xl font-bold text-text">{processingPct}%</div>
      </div>

      <div className="mb-auto rounded-lg border border-border bg-surface p-4.5">
        <p className="text-[13.5px] leading-relaxed text-text-2">{note}</p>
      </div>

      <Link
        href="/"
        className="mt-6 block w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
      >
        Done
      </Link>
    </div>
  );
}

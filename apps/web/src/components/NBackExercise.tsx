"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NBackTask, type NBackStimulus } from "@lean-academy/cognitive-engine";
import {
  epochOffsetMs,
  perfToEpochMs,
  type SessionModeProps,
  type TrialInput,
} from "@/lib/session-types";

// Adapted from prototype/Exercise.dc.html + prototype/ExerciseResults.dc.html.
// One real, honest deviation from the mockup: the prototype's "Exercise 1
// of 3" dots implied a multi-exercise daily session, which doesn't exist
// yet (see docs/kanban.md's Daily Training epic) — showing that here
// would be fabricated progress, so this shows real within-exercise trial
// progress instead. The domain tag is also corrected from the
// prototype's "SPATIAL SEQUENCE" label to "N-BACK", matching what the
// task actually is (data/evidence-registry.json's adaptive-nback-v0).

const TOTAL_TRIALS = 20;
const STIMULUS_MS = 2500;
const FEEDBACK_MS = 650;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

interface Results {
  startDifficulty: number;
  endDifficulty: number;
  accuracy: number;
  scoredTrials: number;
}

export function NBackExercise({ initialDifficulty, onComplete }: SessionModeProps = {}) {
  const [phase, setPhase] = useState<"stimulus" | "feedback" | "done">("stimulus");
  const [stimulus, setStimulus] = useState<NBackStimulus | null>(null);
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [trialNumber, setTrialNumber] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const respondRef = useRef<((said: boolean) => void) | null>(null);
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
    const task = new NBackTask(initialDifficulty !== undefined ? { initialDifficulty } : {});
    const startDifficulty = task.getCurrentDifficulty();
    const offsetMs = epochOffsetMs();
    const trials: TrialInput[] = [];

    async function run() {
      setCurrentN(task.getCurrentN());
      for (let i = 0; i < TOTAL_TRIALS; i++) {
        if (controller.signal.aborted) return;

        const stim = task.nextStimulus();
        const difficultyAtTrial = task.getCurrentN();
        setStimulus(stim);
        setTrialNumber(i + 1);
        setFeedback(null);
        setPhase("stimulus");

        const stimulusStartedAt = performance.now();
        let userSaidMatch = false;
        let reactionTimeMs: number | undefined;
        let interrupted = !visibleRef.current;

        await new Promise<void>((resolveWait) => {
          let settled = false;
          const finish = (said: boolean) => {
            if (settled) return;
            settled = true;
            userSaidMatch = said;
            if (said) reactionTimeMs = performance.now() - stimulusStartedAt;
            respondRef.current = null;
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVis);
            resolveWait();
          };
          const onVis = () => {
            if (document.visibilityState !== "visible") interrupted = true;
          };
          document.addEventListener("visibilitychange", onVis);
          respondRef.current = finish;
          const timer = setTimeout(() => finish(false), STIMULUS_MS);
        });

        if (controller.signal.aborted) return;

        if (!interrupted) {
          const outcome = task.recordResponse(userSaidMatch, {
            timestamp: performance.now(),
            reactionTimeMs,
          });
          if (outcome.scored) {
            setFeedback({ correct: outcome.correct });
            setCurrentN(task.getCurrentN());
            trials.push({
              correct: outcome.correct,
              reactionTimeMs,
              stimulusStartedAtMs: perfToEpochMs(stimulusStartedAt, offsetMs),
              respondedAtMs: perfToEpochMs(performance.now(), offsetMs),
              wasInterrupted: false,
              difficultyAtTrial,
              metadata: { position: stim.position, classification: outcome.classification },
            });
          }
        } else if (stim.isScoreable) {
          // Interrupted trials are excluded from scoring but still
          // recorded (flagged), per docs/product-requirements.md's
          // timing-integrity requirement — visible, not deleted.
          trials.push({
            correct: false,
            stimulusStartedAtMs: perfToEpochMs(stimulusStartedAt, offsetMs),
            wasInterrupted: true,
            difficultyAtTrial,
            metadata: { position: stim.position, interrupted: true },
          });
        }

        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      const perf = task.calculatePerformance();
      const endDifficulty = task.getCurrentDifficulty();
      if (onComplete) {
        onComplete({
          method: "adaptive-nback-v0",
          startDifficulty,
          endDifficulty,
          trials,
          summaryLabel: `Level ${startDifficulty} → ${endDifficulty}`,
        });
        return;
      }
      setResults({
        startDifficulty,
        endDifficulty,
        accuracy: perf.accuracy,
        scoredTrials: perf.trialCount,
      });
      setPhase("done");
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap() {
    respondRef.current?.(true);
  }

  if (phase === "done" && results) {
    return <NBackResults results={results} />;
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label="Exit exercise">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="var(--color-text-3)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </Link>
        <div className="h-1 flex-1 mx-4 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-wm transition-all"
            style={{ width: `${(trialNumber / TOTAL_TRIALS) * 100}%` }}
          />
        </div>
        <div className="w-[18px]" />
      </div>
      <div className="mb-5 text-center text-xs text-text-3">
        Trial {trialNumber} of {TOTAL_TRIALS}
      </div>

      <h1 className="sr-only">Adaptive N-Back exercise</h1>
      <div className="mb-2.5 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-wm" />
        <div className="text-[12.5px] font-bold tracking-wide text-wm">
          WORKING MEMORY · N-BACK
        </div>
      </div>

      <div className="mb-8 text-center font-display text-[19px] font-bold text-text">
        Tap the square if it matches {currentN ?? "…"} step{currentN === 1 ? "" : "s"} back
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-[250px] grid-cols-3 gap-3.5">
          {Array.from({ length: 9 }, (_, i) => {
            const active = phase === "stimulus" && stimulus?.position === i;
            return (
              <div
                key={i}
                className="aspect-square rounded-md border-[1.5px]"
                style={
                  active
                    ? {
                        background: "var(--color-wm)",
                        borderColor: "var(--color-wm)",
                        boxShadow: "0 0 0 7px var(--color-wm-soft)",
                      }
                    : {
                        background: "var(--color-surface-2)",
                        borderColor: "var(--color-border)",
                      }
                }
              />
            );
          })}
        </div>
      </div>

      <div className="my-7 flex justify-center">
        <button
          onClick={handleTap}
          disabled={phase !== "stimulus"}
          data-testid="respond-button"
          className="h-[84px] w-[84px] rounded-full font-body text-sm font-bold text-on-accent transition-transform active:scale-95 disabled:cursor-default"
          style={{
            background:
              feedback?.correct === true
                ? "var(--color-success)"
                : "var(--color-wm)",
          }}
        >
          {feedback ? (feedback.correct ? "Got it" : "Missed") : "Match"}
        </button>
      </div>
      <div className="h-[18px] text-center text-[12.5px] font-bold text-success">
        {feedback?.correct ? "Correct — nice catch" : ""}
      </div>
    </div>
  );
}

function NBackResults({ results }: { results: Results }) {
  const { startDifficulty, endDifficulty, accuracy, scoredTrials } = results;
  const accuracyPct = Math.round(accuracy * 100);

  let note: string;
  if (endDifficulty > startDifficulty) {
    note = `Your accuracy held up while the difficulty increased — that's the sign to keep going, not just a faster pace.`;
  } else if (endDifficulty < startDifficulty) {
    note = `Difficulty eased back a level to keep this challenging but doable. That's the adaptive engine working as intended, not a setback.`;
  } else {
    note = `You held steady at this level across ${scoredTrials} scored trials.`;
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--color-success)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-display text-[23px] font-bold text-text">
          Exercise complete
        </h1>
        <div className="mt-1.5 text-[13.5px] text-text-2">
          Adaptive N-Back
        </div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">ACCURACY</div>
          <div className="font-num text-2xl font-bold text-text">
            {accuracyPct}%
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">LEVEL</div>
          <div className="font-num text-2xl font-bold text-text">
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
        Done
      </Link>
    </div>
  );
}

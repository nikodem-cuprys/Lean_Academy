"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DiceSumTask, DICE_SUM_MAX_COUNT, type DiceSides } from "@lean-academy/cognitive-engine";
import {
  epochOffsetMs,
  perfToEpochMs,
  type SessionModeProps,
  type TrialInput,
  advancedDifficultyBounds,
} from "@/lib/session-types";
import type { DiceSumAdvanced } from "@/lib/advanced-settings";

// Adapted from prototype/ExerciseDiceSum.dc.html: dice are shown for a
// fixed viewing window (with an early-exit "I've got it" button, same
// affordance the mockup shows), then hidden while the player types the
// total on a numpad, reusing the exact digit-keypad interaction
// prototype/ExerciseDigitSpan.dc.html established (already reused by
// BackwardDigitSpanAssessment) rather than inventing a fourth pattern.
// The study/answer/feedback phase loop across 5 rounds is new — the
// mockup is a static single-moment frame, same kind of departure every
// other exercise here already made from its own mockup. See
// docs/evidence-review.md §15 for why this is scoped as a
// working-memory maintenance/updating variant: difficulty adapts dice
// count only, never the arithmetic itself, so copy must never frame
// this as trained math/numeracy improvement.

const TOTAL_ROUNDS = 5;
const SHOW_MS = 4000;
const FEEDBACK_MS = 1400;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

type Phase = "show" | "answer" | "feedback";

interface RoundSummary {
  diceCount: number;
  correctSum: number;
  userSum: number;
  correct: boolean;
}

interface Results {
  startDifficulty: number;
  endDifficulty: number;
  rounds: RoundSummary[];
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [25, 25],
    [75, 25],
    [25, 50],
    [75, 50],
    [25, 75],
    [75, 75],
  ],
};

// Only a real 6-sided die shows pips — every other real tabletop die
// size (d4/d8/d10/d12/d20) is conventionally printed with numerals, not
// pip patterns, so a non-standard dieSides falls back to a numeral to
// match how those dice actually look.
function Die({ face, dieSides }: { face: number; dieSides: number }) {
  const t = useTranslations("diceSum");
  const showPips = dieSides === 6;
  return (
    <div
      className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl border-[1.5px] border-border bg-surface shadow-sm"
      role="img"
      aria-label={t("dieShowing", { face })}
    >
      {showPips ? (
        (PIP_LAYOUTS[face] ?? []).map(([top, left], i) => (
          <span
            key={i}
            className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ top: `${top}%`, left: `${left}%`, background: "var(--color-wm)" }}
          />
        ))
      ) : (
        <span className="font-num text-lg font-bold text-wm">{face}</span>
      )}
    </div>
  );
}

interface DiceSumExerciseProps extends SessionModeProps {
  /** Free customization (see apps/web/src/lib/exercise-preferences.ts) — defaults to the standard 6-sided die when omitted, same as session mode always gets. */
  dieSides?: DiceSides;
  /** Advanced-tab lesson parameters (see apps/web/src/lib/advanced-settings.ts) — each overrides the matching constant/preset above. */
  advanced?: DiceSumAdvanced;
}

export function DiceSumExercise({ initialDifficulty, onComplete, dieSides, advanced, exitHref = "/" }: DiceSumExerciseProps = {}) {
  const t = useTranslations("diceSum");
  const tx = useTranslations("exercise");
  const effectiveDieSides = advanced?.dieSides ?? dieSides ?? 6;
  const totalRounds = advanced?.rounds ?? TOTAL_ROUNDS;
  const showMs = advanced?.showMs ?? SHOW_MS;
  const feedbackMs = advanced?.feedbackMs ?? FEEDBACK_MS;
  const maxTypedDigits = String(effectiveDieSides * DICE_SUM_MAX_COUNT).length;
  const [phase, setPhase] = useState<Phase>("show");
  const [roundNumber, setRoundNumber] = useState(0);
  const [dice, setDice] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<RoundSummary | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const showResolveRef = useRef<(() => void) | null>(null);
  const answerResolveRef = useRef<((sum: number) => void) | null>(null);
  const typedRef = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    const task = new DiceSumTask({
      ...(initialDifficulty !== undefined ? { initialDifficulty } : {}),
      ...advancedDifficultyBounds(advanced),
      dieSides: effectiveDieSides,
    });
    const startDifficulty = task.getCurrentDifficulty();
    const rounds: RoundSummary[] = [];
    const offsetMs = epochOffsetMs();
    const trials: TrialInput[] = [];

    async function waitForShowDone(): Promise<void> {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          showResolveRef.current = null;
          clearTimeout(timer);
          resolve();
        };
        showResolveRef.current = finish;
        const timer = setTimeout(finish, showMs);
        // See NBackExercise.tsx's identical fix: without this, an
        // aborted run (React Strict Mode's dev-only double-invoke of
        // this effect) keeps waiting out its own full SHOW_MS timer
        // instead of noticing it was cancelled, racing a second real
        // run through the same UI state.
        controller.signal.addEventListener("abort", finish, { once: true });
      });
    }

    async function waitForAnswerSubmit(): Promise<number> {
      return new Promise<number>((resolve) => {
        answerResolveRef.current = resolve;
      });
    }

    async function run() {
      for (let r = 0; r < totalRounds; r++) {
        if (controller.signal.aborted) return;

        const roundStartedAt = performance.now();
        const rolled = task.startRound();
        setRoundNumber(r + 1);
        setDice(rolled);
        setTyped("");
        typedRef.current = "";
        setPhase("show");

        await waitForShowDone();
        if (controller.signal.aborted) return;

        setPhase("answer");
        const userSum = await waitForAnswerSubmit();
        if (controller.signal.aborted) return;

        const respondedAt = performance.now();
        const outcome = task.submitAnswer(userSum, { timestamp: respondedAt });
        const summary: RoundSummary = {
          diceCount: outcome.diceCount,
          correctSum: outcome.correctSum,
          userSum: outcome.userSum,
          correct: outcome.correct,
        };
        rounds.push(summary);
        trials.push({
          correct: outcome.correct,
          stimulusStartedAtMs: perfToEpochMs(roundStartedAt, offsetMs),
          respondedAtMs: perfToEpochMs(respondedAt, offsetMs),
          wasInterrupted: false,
          difficultyAtTrial: outcome.diceCount,
          metadata: { diceCount: outcome.diceCount, correctSum: outcome.correctSum, userSum: outcome.userSum },
        });
        setFeedback(summary);
        setPhase("feedback");
        await sleep(feedbackMs, controller.signal);
        if (controller.signal.aborted) return;
      }

      const endDifficulty = task.getCurrentDifficulty();
      if (onComplete) {
        onComplete({
          method: "dice-sum-v0",
          startDifficulty,
          endDifficulty,
          trials,
          summaryLabel: t("summary", { start: startDifficulty, end: endDifficulty }),
        });
        return;
      }
      setResults({ startDifficulty, endDifficulty, rounds });
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleHideDice() {
    showResolveRef.current?.();
  }

  function handlePressDigit(n: number) {
    if (typedRef.current.length >= maxTypedDigits) return;
    typedRef.current = typedRef.current + String(n);
    setTyped(typedRef.current);
  }

  function handleBackspace() {
    typedRef.current = typedRef.current.slice(0, -1);
    setTyped(typedRef.current);
  }

  function handleSubmit() {
    if (typedRef.current.length === 0) return;
    const sum = Number(typedRef.current);
    answerResolveRef.current?.(sum);
    answerResolveRef.current = null;
  }

  if (results) {
    return <DiceSumResults results={results} />;
  }

  return (
    <div
      className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5"
      data-testid="dice-sum-exercise"
      data-die-sides={effectiveDieSides}
    >
      <div className="mb-2 flex items-center justify-between">
        <Link href={exitHref} aria-label={tx("exit")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="mx-4 h-1 flex-1 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-wm transition-all"
            style={{ width: `${(roundNumber / totalRounds) * 100}%` }}
          />
        </div>
        <div className="w-[18px]" />
      </div>
      <div className="mb-4 text-center text-xs text-text-3">
        {tx("roundOf", { current: roundNumber, total: totalRounds })}
      </div>

      <h1 className="sr-only">{t("srTitle")}</h1>
      <div className="mb-4 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-wm" />
        <div className="text-[12.5px] font-bold tracking-wide text-wm">{t("tag")}</div>
      </div>

      {phase === "show" && (
        <div className="flex flex-1 flex-col">
          <div className="text-center font-display text-lg font-bold text-text">
            {t("remember")}
          </div>
          <div className="mb-2 text-center text-[12.5px] text-text-3">
            {effectiveDieSides === 6
              ? t("shownFor", { count: dice.length, seconds: showMs / 1000 })
              : t("shownForSided", { count: dice.length, sides: effectiveDieSides, seconds: showMs / 1000 })}
          </div>
          <div className="mb-9 h-[5px] overflow-hidden rounded-full bg-surface-2">
            <div
              key={roundNumber}
              className="h-full rounded-full bg-wm animate-dice-countdown"
              style={{ animationDuration: `${showMs}ms` }}
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-3" data-testid="dice-display">
            {dice.map((face, i) => (
              <Die key={i} face={face} dieSides={effectiveDieSides} />
            ))}
          </div>
          <button
            type="button"
            data-testid="hide-dice-button"
            onClick={handleHideDice}
            className="mt-6 w-full rounded-full bg-wm py-3.5 text-center font-body text-[14.5px] font-bold text-on-accent transition-transform duration-micro active:scale-95"
          >
            I&rsquo;ve got it — hide the dice
          </button>
        </div>
      )}

      {(phase === "answer" || phase === "feedback") && (
        <div className="flex flex-1 flex-col">
          <div className="mb-1 text-center font-display text-lg font-bold text-text">
            {phase === "feedback"
              ? feedback?.correct
                ? t("correct")
                : t("notQuite")
              : t("whatsTotal")}
          </div>
          <div className="mb-8 text-center text-[12.5px] text-text-3">
            {phase === "feedback"
              ? feedback?.correct
                ? t("summedTo", { count: feedback.diceCount, sum: feedback.correctSum })
                : t("totalWas", { sum: feedback?.correctSum ?? 0 })
              : t("addUp", { count: dice.length })}
          </div>
          <div className="mb-8 flex justify-center">
            <div
              data-testid="answer-display"
              className="min-w-[120px] rounded-md border-[1.5px] px-6 py-3.5 text-center font-num text-3xl font-bold text-text"
              style={{
                borderColor: typed ? "var(--color-wm)" : "var(--color-border)",
                background: typed ? "var(--color-wm-soft)" : "var(--color-surface)",
              }}
            >
              {typed || "—"}
            </div>
          </div>
          <div className="flex-1" />
          {phase === "answer" && (
            <>
              <div className="mb-3.5 grid grid-cols-3 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-testid={`keypad-key-${n}`}
                    onClick={() => handlePressDigit(n)}
                    disabled={typed.length >= maxTypedDigits}
                    className="aspect-square rounded-[14px] border border-border bg-surface font-num text-lg font-bold text-text disabled:opacity-40"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="keypad-backspace"
                  onClick={handleBackspace}
                  disabled={typed.length === 0}
                  aria-label={t("backspace")}
                  className="aspect-square rounded-[14px] border border-border bg-surface text-sm text-text-2 disabled:opacity-40"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  data-testid="keypad-key-0"
                  onClick={() => handlePressDigit(0)}
                  disabled={typed.length >= maxTypedDigits}
                  className="aspect-square rounded-[14px] border border-border bg-surface font-num text-lg font-bold text-text disabled:opacity-40"
                >
                  0
                </button>
                <div />
              </div>
              <button
                type="button"
                data-testid="answer-submit"
                onClick={handleSubmit}
                disabled={typed.length === 0}
                className="w-full rounded-full bg-wm py-3.5 text-center font-body text-[15px] font-bold text-on-accent disabled:opacity-40"
              >
                {t("submit")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DiceSumResults({ results }: { results: Results }) {
  const t = useTranslations("diceSum");
  const tx = useTranslations("exercise");
  const { startDifficulty, endDifficulty, rounds } = results;
  const correctRounds = rounds.filter((r) => r.correct).length;

  let note: string;
  if (endDifficulty > startDifficulty) {
    note = t("noteUp");
  } else if (endDifficulty < startDifficulty) {
    note = t("noteDown");
  } else {
    note = t("noteSteady", { rounds: rounds.length });
  }

  const countIncreased = endDifficulty > startDifficulty;

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
          <div className="mb-1 text-[11.5px] text-text-3">{t("correctSums")}</div>
          <div className="font-num text-2xl font-bold text-text">
            {correctRounds}/{rounds.length}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{t("diceCount")}</div>
          <div className={`font-num text-2xl font-bold text-text ${countIncreased ? "animate-celebration-pop" : ""}`}>
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

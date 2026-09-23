"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  PacedReadingTask,
  calculateReadingEfficiencyScore,
  READING_PASSAGES,
  type Passage,
} from "@lean-academy/reading-engine";
import {
  epochOffsetMs,
  perfToEpochMs,
  type SessionModeProps,
  type TrialInput,
} from "@/lib/session-types";

// Adapted from prototype/ExerciseReading.dc.html: a passage is shown
// with a visual pace guide (a highlight that sweeps forward through
// word chunks at the current target WPM), then one multiple-choice
// comprehension question. The prototype shows a single highlighted
// sentence as a static mockup frame; the sweeping behavior across the
// whole passage, and the reading/question/feedback phase loop across
// multiple passages, are new — same kind of departure N-Back/Complex
// Span/Spatial Sequence already made from their own single-frame
// mockups. The prototype's 3 progress dots are a generic
// multi-exercise-session placeholder (see N-Back's kanban note); this
// uses a real "Passage N of 5" progress bar instead, same as the other
// three exercises.
//
// The pace guide is only ever a suggestion, never a gate: actual WPM
// is measured from real elapsed time between the passage appearing and
// the reader clicking "I've finished reading," not from the guide's
// speed — matching evidence-review.md §8's "the user reads normally
// while pacing increases."
//
// Passage order is real, not fixed: on mount, this fetches the user's
// real least-recently-seen passage order from
// /api/reading-passage-order (this is a client component with no
// direct DB access) and seeds PacedReadingTask's passagePool with it,
// falling back to the engine's own declared order if the fetch fails
// — never blocking the exercise on it. See docs/kanban.md's "Expand
// and rotate the reading-passage bank" card and
// apps/web/src/lib/reading-passage-rotation.ts.
//
// Passages and their comprehension questions are English-only in every
// UI language: the WPM ladder and the 70% comprehension floor are
// calibrated on English text (docs/evidence-review.md §8), and WPM isn't
// comparable across languages (Chinese isn't even space-delimited), so
// translating them would quietly change what's measured. The exercise
// chrome is translated; the passage text is marked lang="en", and a
// non-English UI shows a one-line note saying so.

const TOTAL_PASSAGES = 5;
const CHUNK_SIZE = 4; // words per pacer highlight step
const FEEDBACK_MS = 1400;

// Text-size and text-width are per-viewer reading comfort preferences,
// not exercise state — persisted in localStorage (guarded, since this
// runs client-side only) rather than the DB, same rationale as any
// other purely-cosmetic per-device setting. Purely additive: they
// don't touch pacing, timing, or scoring.
type TextSize = "normal" | "large" | "xlarge";
const TEXT_SIZES: readonly TextSize[] = ["normal", "large", "xlarge"];
const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  normal: "text-[15.5px]",
  large: "text-[18px]",
  xlarge: "text-[21px]",
};
const TEXT_SIZE_STORAGE_KEY = "lean-academy:reading-text-size";
const WIDE_TEXT_STORAGE_KEY = "lean-academy:reading-wide-text";

function loadStringPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return (allowed as readonly string[]).includes(stored ?? "") ? (stored as T) : fallback;
  } catch {
    return fallback;
  }
}

function storePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort only — a private window or blocked storage just means
    // the preference resets next visit, not a broken exercise.
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => clearTimeout(t), { once: true });
  });
}

function chunkWords(text: string): string[][] {
  const words = text.trim().split(/\s+/);
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

type Phase = "reading" | "question" | "feedback";

interface PassageSummary {
  correct: boolean;
  actualWpm: number;
}

interface Results {
  startDifficultyWpm: number;
  endDifficultyWpm: number;
  passages: PassageSummary[];
  averageWpm: number;
  comprehensionAccuracy: { correct: number; total: number };
}

export function PacedReadingExercise({ initialDifficulty, onComplete }: SessionModeProps = {}) {
  const t = useTranslations("reading");
  const tx = useTranslations("exercise");
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("reading");
  const [passageNumber, setPassageNumber] = useState(0);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [targetWpm, setTargetWpm] = useState(0);
  const [highlightChunk, setHighlightChunk] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctText: string } | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [textSize, setTextSize] = useState<TextSize>(() =>
    loadStringPreference(TEXT_SIZE_STORAGE_KEY, TEXT_SIZES, "normal")
  );
  const [wideText, setWideText] = useState(
    () => loadStringPreference(WIDE_TEXT_STORAGE_KEY, ["on", "off"] as const, "off") === "on"
  );

  function handleSetTextSize(size: TextSize) {
    setTextSize(size);
    storePreference(TEXT_SIZE_STORAGE_KEY, size);
  }

  function handleToggleWideText() {
    setWideText((w) => {
      const next = !w;
      storePreference(WIDE_TEXT_STORAGE_KEY, next ? "on" : "off");
      return next;
    });
  }

  const finishReadingResolveRef = useRef<(() => void) | null>(null);
  const submitAnswerResolveRef = useRef<((choice: number) => void) | null>(null);
  const selectedChoiceRef = useRef<number | null>(null);
  const readingStartRef = useRef(0);
  const stopPacerRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const passages: PassageSummary[] = [];
    const offsetMs = epochOffsetMs();
    const trials: TrialInput[] = [];

    async function fetchPassagePool(): Promise<Passage[]> {
      try {
        const res = await fetch("/api/reading-passage-order", { signal: controller.signal });
        if (!res.ok) return READING_PASSAGES;
        const data: { order?: unknown } = await res.json();
        if (!Array.isArray(data.order)) return READING_PASSAGES;
        const byId = new Map(READING_PASSAGES.map((p) => [p.id, p]));
        const ordered = data.order.map((id) => (typeof id === "string" ? byId.get(id) : undefined));
        if (ordered.length !== READING_PASSAGES.length || ordered.some((p) => !p)) return READING_PASSAGES;
        return ordered as Passage[];
      } catch {
        return READING_PASSAGES; // never block the exercise on this
      }
    }

    async function waitForFinishReading(): Promise<void> {
      await new Promise<void>((resolve) => {
        finishReadingResolveRef.current = resolve;
      });
    }

    async function waitForAnswerSubmit(): Promise<number> {
      return new Promise<number>((resolve) => {
        submitAnswerResolveRef.current = resolve;
      });
    }

    async function runPacer(chunks: string[][], wpm: number) {
      const msPerWord = 60_000 / wpm;
      for (let c = 0; c < chunks.length; c++) {
        if (controller.signal.aborted || stopPacerRef.current) return;
        setHighlightChunk(c);
        await sleep(chunks[c].length * msPerWord, controller.signal);
      }
    }

    async function run() {
      const passagePool = await fetchPassagePool();
      if (controller.signal.aborted) return;
      const task = new PacedReadingTask({
        passagePool,
        ...(initialDifficulty !== undefined ? { initialDifficulty } : {}),
      });
      const startDifficulty = task.getCurrentDifficulty();
      const startDifficultyWpm = task.getCurrentTargetWpm();

      for (let p = 0; p < TOTAL_PASSAGES; p++) {
        if (controller.signal.aborted) return;

        const nextPassage = task.nextPassage();
        const wpm = task.getCurrentTargetWpm();
        const difficultyAtTrial = task.getCurrentDifficulty();
        setPassageNumber(p + 1);
        setPassage(nextPassage);
        setTargetWpm(wpm);
        setHighlightChunk(0);
        setSelectedChoice(null);
        selectedChoiceRef.current = null;
        setPhase("reading");

        stopPacerRef.current = false;
        runPacer(chunkWords(nextPassage.text), wpm);
        readingStartRef.current = performance.now();

        await waitForFinishReading();
        if (controller.signal.aborted) return;
        stopPacerRef.current = true;
        const elapsedMs = performance.now() - readingStartRef.current;

        setPhase("question");
        const chosenIndex = await waitForAnswerSubmit();
        if (controller.signal.aborted) return;

        const answeredCorrectly = chosenIndex === nextPassage.question.correctIndex;
        const respondedAt = performance.now();
        const outcome = task.recordPassageResult({
          answeredCorrectly,
          elapsedMs,
          timestamp: respondedAt,
        });
        passages.push({ correct: outcome.correct, actualWpm: outcome.actualWpm });
        trials.push({
          correct: outcome.correct,
          stimulusStartedAtMs: perfToEpochMs(readingStartRef.current, offsetMs),
          respondedAtMs: perfToEpochMs(respondedAt, offsetMs),
          wasInterrupted: false,
          difficultyAtTrial,
          metadata: { actualWpm: outcome.actualWpm, passageId: nextPassage.id },
        });
        setFeedback({
          correct: answeredCorrectly,
          correctText: nextPassage.question.choices[nextPassage.question.correctIndex],
        });
        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      const endDifficulty = task.getCurrentDifficulty();
      const endDifficultyWpm = task.getCurrentTargetWpm();
      if (onComplete) {
        onComplete({
          method: "reading-paced-adaptive-v0",
          startDifficulty,
          endDifficulty,
          trials,
          summaryLabel: t("summary", { start: startDifficultyWpm, end: endDifficultyWpm }),
        });
        return;
      }
      setResults({
        startDifficultyWpm,
        endDifficultyWpm,
        passages,
        averageWpm: task.getAverageWpm(),
        comprehensionAccuracy: task.getComprehensionAccuracy(),
      });
    }

    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFinishReading() {
    finishReadingResolveRef.current?.();
    finishReadingResolveRef.current = null;
  }

  function handleSelectChoice(index: number) {
    selectedChoiceRef.current = index;
    setSelectedChoice(index);
  }

  function handleSubmitAnswer() {
    if (selectedChoiceRef.current === null) return;
    submitAnswerResolveRef.current?.(selectedChoiceRef.current);
    submitAnswerResolveRef.current = null;
  }

  if (results) {
    return <PacedReadingResults results={results} />;
  }

  return (
    <div
      className={`flex w-full flex-1 flex-col px-5 py-5 transition-[max-width] ${wideText ? "max-w-[640px]" : "max-w-[390px]"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label={tx("exit")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="mx-4 h-1 flex-1 rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-reading transition-all"
            style={{ width: `${(passageNumber / TOTAL_PASSAGES) * 100}%` }}
          />
        </div>
        <div className="w-[18px]" />
      </div>
      <div className="mb-4 text-center text-xs text-text-3">
        {t("passageOf", { current: passageNumber, total: TOTAL_PASSAGES })}
      </div>

      <h1 className="sr-only">{t("srTitle")}</h1>
      <div className="mb-4 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-reading" />
        <div className="text-[12.5px] font-bold tracking-wide text-reading">
          {t("tag")}
        </div>
      </div>

      {locale !== "en" && (
        <div className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-center text-[11.5px] leading-snug text-text-3" data-testid="reading-english-note">
          {t("englishNote")}
        </div>
      )}

      {passage && phase === "reading" && (
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div role="group" aria-label={t("textSize")} className="flex items-center gap-1 rounded-full border border-border p-0.5">
                {TEXT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    data-testid={`text-size-${size}`}
                    aria-pressed={textSize === size}
                    aria-label={t(`textSizes.${size}`)}
                    onClick={() => handleSetTextSize(size)}
                    className="min-h-[24px] min-w-[24px] rounded-full px-2 py-1.5 font-body font-bold leading-none"
                    style={{
                      fontSize: size === "normal" ? 12 : size === "large" ? 14 : 16,
                      background: textSize === size ? "var(--color-reading-soft)" : "transparent",
                      color: textSize === size ? "var(--color-reading)" : "var(--color-text-3)",
                    }}
                  >
                    A
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="wide-text-toggle"
                aria-pressed={wideText}
                onClick={handleToggleWideText}
                className="min-h-[24px] rounded-full border-[1.5px] px-2.5 py-1.5 font-body text-[12px] font-bold"
                style={{
                  borderColor: wideText ? "var(--color-reading)" : "var(--color-border)",
                  background: wideText ? "var(--color-reading-soft)" : "transparent",
                  color: wideText ? "var(--color-reading)" : "var(--color-text-3)",
                }}
              >
                {t("wide")}
              </button>
            </div>
            <div
              data-testid="target-wpm"
              className="rounded-full px-3 py-1 font-num text-[13px] font-bold text-reading"
              style={{ background: "var(--color-reading-soft)" }}
            >
              {t("wpmValue", { value: targetWpm })}
            </div>
          </div>
          <div lang="en" className={`flex-1 overflow-y-auto leading-relaxed text-text-2 ${TEXT_SIZE_CLASS[textSize]}`}>
            {chunkWords(passage.text).map((chunk, i) => (
              <span
                key={i}
                style={{
                  background: i === highlightChunk ? "var(--color-reading-soft)" : "transparent",
                  color: i === highlightChunk ? "var(--color-text)" : undefined,
                  borderRadius: 4,
                }}
              >
                {chunk.join(" ")}{" "}
              </span>
            ))}
          </div>
          <button
            data-testid="finish-reading-button"
            onClick={handleFinishReading}
            className="mt-4 w-full rounded-full bg-reading py-3.5 text-center font-body text-[14.5px] font-bold text-on-accent transition-transform duration-micro active:scale-95"
          >
            {t("finished")}
          </button>
        </div>
      )}

      {passage && (phase === "question" || phase === "feedback") && (
        <div className="flex flex-1 flex-col">
          {phase === "question" ? (
            <>
              <div data-testid="question-prompt" lang="en" className="mb-5 font-display text-lg font-bold leading-snug text-text">
                {passage.question.prompt}
              </div>
              <div role="radiogroup" aria-label={passage.question.prompt} lang="en" className="flex flex-col gap-2.5">
                {passage.question.choices.map((choice, i) => {
                  const isSelected = selectedChoice === i;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      key={i}
                      data-testid={`answer-choice-${i}`}
                      onClick={() => handleSelectChoice(i)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border-[1.5px] px-3.5 py-3 text-left text-[13.5px] transition-transform duration-micro active:scale-[0.98]"
                      style={{
                        borderColor: isSelected ? "var(--color-reading)" : "var(--color-border)",
                        background: isSelected ? "var(--color-reading-soft)" : "var(--color-surface)",
                      }}
                    >
                      <div
                        className="h-[18px] w-[18px] flex-shrink-0 rounded-full border-2"
                        style={{ borderColor: isSelected ? "var(--color-reading)" : "var(--color-border)" }}
                      />
                      {choice}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1" />
              <button
                data-testid="submit-answer-button"
                onClick={handleSubmitAnswer}
                disabled={selectedChoice === null}
                className="w-full rounded-full bg-reading py-3.5 text-center font-body text-[15px] font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                {t("submitAnswer")}
              </button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="font-display text-lg font-bold text-text">
                {feedback?.correct ? t("correct") : t("notQuite")}
              </div>
              {!feedback?.correct && (
                <div className="mt-2 text-[13.5px] text-text-2">
                  {t("answerWas")} <span lang="en">{feedback?.correctText}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PacedReadingResults({ results }: { results: Results }) {
  const t = useTranslations("reading");
  const tx = useTranslations("exercise");
  const { startDifficultyWpm, endDifficultyWpm, passages, averageWpm, comprehensionAccuracy } = results;
  const comprehensionPct =
    comprehensionAccuracy.total > 0
      ? Math.round((comprehensionAccuracy.correct / comprehensionAccuracy.total) * 100)
      : 0;
  const efficiencyScore = Math.round(
    calculateReadingEfficiencyScore({
      averageWpm,
      comprehensionAccuracy: comprehensionAccuracy.total > 0 ? comprehensionAccuracy.correct / comprehensionAccuracy.total : 0,
    })
  );

  let note: string;
  if (endDifficultyWpm > startDifficultyWpm) {
    note = t("noteUp");
  } else if (endDifficultyWpm < startDifficultyWpm) {
    note = t("noteDown");
  } else {
    note = t("noteSteady", { passages: passages.length });
  }

  const paceIncreased = endDifficultyWpm > startDifficultyWpm;

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
          <div className="mb-1 text-[11.5px] text-text-3">{t("avgWpm")}</div>
          <div className="font-num text-2xl font-bold text-text">{Math.round(averageWpm)}</div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">{t("comprehension")}</div>
          <div className="font-num text-2xl font-bold text-text">{comprehensionPct}%</div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4.5">
        <div className="mb-1 text-[11.5px] text-text-3">{t("targetPace")}</div>
        <div className={`font-num text-xl font-bold text-text ${paceIncreased ? "animate-celebration-pop" : ""}`}>
          {t("summary", { start: startDifficultyWpm, end: endDifficultyWpm })}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4.5">
        <div className="mb-1 text-[11.5px] text-text-3">{t("efficiencyScore")}</div>
        <div className="font-num text-xl font-bold text-text">{efficiencyScore}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-text-3">
          {t("efficiencyExplainer")}
        </p>
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

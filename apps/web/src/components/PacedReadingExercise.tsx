"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PacedReadingTask,
  calculateReadingEfficiencyScore,
  type Passage,
} from "@lean-academy/reading-engine";

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

const TOTAL_PASSAGES = 5;
const CHUNK_SIZE = 4; // words per pacer highlight step
const FEEDBACK_MS = 1400;

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

export function PacedReadingExercise() {
  const [phase, setPhase] = useState<Phase>("reading");
  const [passageNumber, setPassageNumber] = useState(0);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [targetWpm, setTargetWpm] = useState(0);
  const [highlightChunk, setHighlightChunk] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctText: string } | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const finishReadingResolveRef = useRef<(() => void) | null>(null);
  const submitAnswerResolveRef = useRef<((choice: number) => void) | null>(null);
  const selectedChoiceRef = useRef<number | null>(null);
  const readingStartRef = useRef(0);
  const stopPacerRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const task = new PacedReadingTask();
    const startDifficultyWpm = task.getCurrentTargetWpm();
    const passages: PassageSummary[] = [];

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
      for (let p = 0; p < TOTAL_PASSAGES; p++) {
        if (controller.signal.aborted) return;

        const nextPassage = task.nextPassage();
        const wpm = task.getCurrentTargetWpm();
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
        const outcome = task.recordPassageResult({
          answeredCorrectly,
          elapsedMs,
          timestamp: performance.now(),
        });
        passages.push({ correct: outcome.correct, actualWpm: outcome.actualWpm });
        setFeedback({
          correct: answeredCorrectly,
          correctText: nextPassage.question.choices[nextPassage.question.correctIndex],
        });
        setPhase("feedback");
        await sleep(FEEDBACK_MS, controller.signal);
        if (controller.signal.aborted) return;
      }

      setResults({
        startDifficultyWpm,
        endDifficultyWpm: task.getCurrentTargetWpm(),
        passages,
        averageWpm: task.getAverageWpm(),
        comprehensionAccuracy: task.getComprehensionAccuracy(),
      });
    }

    run();
    return () => controller.abort();
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
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-5 py-5">
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" aria-label="Exit exercise">
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
        Passage {passageNumber} of {TOTAL_PASSAGES}
      </div>

      <div className="mb-4 flex items-center justify-center gap-1.5">
        <div className="h-[7px] w-[7px] rounded-full bg-reading" />
        <div className="text-[12.5px] font-bold tracking-wide text-reading">
          READING · PACED PASSAGE
        </div>
      </div>

      {passage && phase === "reading" && (
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex justify-end">
            <div
              data-testid="target-wpm"
              className="rounded-full px-3 py-1 font-num text-[13px] font-bold text-reading"
              style={{ background: "var(--color-reading-soft)" }}
            >
              {targetWpm} WPM
            </div>
          </div>
          <div className="flex-1 overflow-y-auto text-[15.5px] leading-relaxed text-text-2">
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
            className="mt-4 w-full rounded-full bg-reading py-3.5 text-center font-body text-[14.5px] font-bold text-on-accent"
          >
            I&rsquo;ve finished reading
          </button>
        </div>
      )}

      {passage && (phase === "question" || phase === "feedback") && (
        <div className="flex flex-1 flex-col">
          {phase === "question" ? (
            <>
              <div data-testid="question-prompt" className="mb-5 font-display text-lg font-bold leading-snug text-text">
                {passage.question.prompt}
              </div>
              <div className="flex flex-col gap-2.5">
                {passage.question.choices.map((choice, i) => {
                  const isSelected = selectedChoice === i;
                  return (
                    <div
                      key={i}
                      data-testid={`answer-choice-${i}`}
                      onClick={() => handleSelectChoice(i)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border-[1.5px] px-3.5 py-3 text-[13.5px]"
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
                    </div>
                  );
                })}
              </div>
              <div className="flex-1" />
              <button
                data-testid="submit-answer-button"
                onClick={handleSubmitAnswer}
                disabled={selectedChoice === null}
                className="w-full rounded-full bg-reading py-3.5 text-center font-body text-[15px] font-bold text-on-accent disabled:opacity-40"
              >
                Submit answer
              </button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="font-display text-lg font-bold text-text">
                {feedback?.correct ? "Correct" : "Not quite"}
              </div>
              {!feedback?.correct && (
                <div className="mt-2 text-[13.5px] text-text-2">
                  The answer was: {feedback?.correctText}
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
    note = `Comprehension held up well enough at this pace that the target speed increased — that's the adaptive engine responding, not a guarantee it'll keep climbing.`;
  } else if (endDifficultyWpm < startDifficultyWpm) {
    note = `Pace eased back a notch to protect comprehension. That's the adaptive engine working as intended, not a setback.`;
  } else {
    note = `You held steady at this pace across ${passages.length} passages.`;
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="font-display text-[23px] font-bold text-text">Exercise complete</div>
        <div className="mt-1.5 text-[13.5px] text-text-2">Paced Reading</div>
      </div>

      <div className="mb-4 flex justify-around rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">AVG WPM</div>
          <div className="font-num text-2xl font-bold text-text">{Math.round(averageWpm)}</div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="mb-1 text-[11.5px] text-text-3">COMPREHENSION</div>
          <div className="font-num text-2xl font-bold text-text">{comprehensionPct}%</div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4.5">
        <div className="mb-1 text-[11.5px] text-text-3">TARGET PACE</div>
        <div className="font-num text-xl font-bold text-text">
          {startDifficultyWpm} → {endDifficultyWpm} WPM
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4.5">
        <div className="mb-1 text-[11.5px] text-text-3">READING EFFICIENCY SCORE</div>
        <div className="font-num text-xl font-bold text-text">{efficiencyScore}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-text-3">
          WPM × comprehension, with speed counting for less below a 70% comprehension floor — never shown without both numbers above.
        </p>
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

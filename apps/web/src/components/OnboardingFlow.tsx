"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  NBackTask,
  ComplexSpanTask,
  SpatialSequenceTask,
} from "@lean-academy/cognitive-engine";
import { PacedReadingTask, READING_PASSAGES, type Passage } from "@lean-academy/reading-engine";

// Implements project_prompt.txt's onboarding sequence: "goals ->
// available time -> experience level -> short calibration -> recommended
// level (accept or change) -> first plan." Built as one route with
// internal phase state (like each exercise's own internal phase state
// machine) rather than 4 separate routes per prototype/.dc.html file,
// since none of this needs to touch the database until the very last
// step — a deliberate departure from "one route per prototype screen,"
// documented here the same way other exercises documented their own
// departures from a single-frame mockup.
//
// The calibration battery (prototype/Baseline.dc.html) reuses the real
// task engines already built for the 4 exercises, run very briefly (2
// spatial-sequence rounds, 1 warm-up + 2 scoreable n-back stimuli at a
// fixed N=1, one 3-letter simple-span recall with no processing step,
// one reading passage) rather than inventing separate "mini" scoring
// logic — matching "about 90 seconds, no pass or fail" from the mockup.
// It intentionally skips the moving pace guide and the letter-span's
// arithmetic processing step (both belong to the trained-task exercises
// themselves, not a quick calibration probe).

type Goal = "working-memory" | "concentration" | "reading-efficiency" | "memory-strategies" | "habit" | "balanced";
type ExperienceLevel = "new" | "some" | "experienced";
type DifficultyLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" | "AUTO";
type CalibrationMethod =
  | "visuospatial-sequence-recall-v0"
  | "adaptive-nback-v0"
  | "complex-span-v0"
  | "reading-paced-adaptive-v0";

type Phase = "goals" | "time" | "experience" | "calibration" | "recommend" | "submitting" | "done";

// Option order only — every label/note is looked up in the messages
// files (onboarding.goals.<id>, onboarding.time.<minutes>, ...).
const GOAL_OPTIONS: Goal[] = ["working-memory", "concentration", "reading-efficiency", "memory-strategies", "habit", "balanced"];

const TIME_OPTIONS = [5, 10, 15, 20] as const;

const EXPERIENCE_OPTIONS: ExperienceLevel[] = ["new", "some", "experienced"];

const DIFFICULTY_OPTIONS: DifficultyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", "AUTO"];

const RECALL_LETTERS = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fisher-Yates shuffle — doesn't mutate the input array. */
function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface CalibrationTally {
  method: CalibrationMethod;
  correct: number;
  total: number;
}

function recommendLevel(experienceLevel: ExperienceLevel, accuracy: number): DifficultyLevel {
  const tiers: DifficultyLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  let index = 1; // INTERMEDIATE by default
  if (accuracy >= 0.8) index += 1;
  else if (accuracy < 0.4) index -= 1;
  if (experienceLevel === "experienced") index += 1;
  else if (experienceLevel === "new") index -= 1;
  index = Math.max(0, Math.min(tiers.length - 1, index));
  return tiers[index];
}

export function OnboardingFlow() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("goals");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(10);
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>("AUTO");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const effectiveMinutes = isCustomTime ? Number(customMinutes) || null : dailyMinutes;
  const calibrationResultsRef = useRef<CalibrationTally[]>([]);

  function goToTime() {
    if (!goal) return;
    setPhase("time");
  }

  function goToExperience() {
    if (!effectiveMinutes || effectiveMinutes < 1) return;
    setPhase("experience");
  }

  function goToCalibration() {
    if (!experienceLevel) return;
    setPhase("calibration");
  }

  function onCalibrationDone(results: CalibrationTally[]) {
    calibrationResultsRef.current = results;
    const totalCorrect = results.reduce((sum, r) => sum + r.correct, 0);
    const totalCount = results.reduce((sum, r) => sum + r.total, 0);
    const accuracy = totalCount > 0 ? totalCorrect / totalCount : 0.5;
    setDifficultyLevel(recommendLevel(experienceLevel!, accuracy));
    setPhase("recommend");
  }

  async function finishOnboarding() {
    setPhase("submitting");
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          dailyMinutes: effectiveMinutes,
          experienceLevel,
          difficultyLevel,
          calibration: calibrationResultsRef.current,
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setPhase("done");
      router.push("/");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      setSubmitError(t("submitError"));
      setPhase("recommend");
    }
  }

  if (phase === "goals") {
    return (
      <OnboardingStep step={1} title={t("goalsTitle")} subtitle={t("goalsSubtitle")}>
        <div role="radiogroup" aria-label={t("goalsTitle")} className="flex flex-col gap-2.5">
          {GOAL_OPTIONS.map((id) => (
            <OptionRow key={id} testId={`goal-${id}`} selected={goal === id} label={t(`goals.${id}`)} onClick={() => setGoal(id)} />
          ))}
        </div>
        <ContinueButton testId="goals-continue" disabled={!goal} onClick={goToTime} />
      </OnboardingStep>
    );
  }

  if (phase === "time") {
    return (
      <OnboardingStep step={2} title={t("timeTitle")} subtitle={t("timeSubtitle")}>
        <div role="radiogroup" aria-label={t("timeTitle")} className="flex flex-col gap-3">
          {TIME_OPTIONS.map((minutes) => (
            <OptionRow
              key={minutes}
              testId={`time-${minutes}`}
              selected={!isCustomTime && dailyMinutes === minutes}
              label={t("minutes", { minutes })}
              note={t(`timeNotes.${minutes}`)}
              onClick={() => {
                setIsCustomTime(false);
                setDailyMinutes(minutes);
              }}
            />
          ))}
          <OptionRow
            testId="time-custom"
            selected={isCustomTime}
            label={t("custom")}
            note={t("customNote")}
            onClick={() => setIsCustomTime(true)}
          />
          {isCustomTime && (
            <input
              data-testid="custom-minutes-input"
              type="number"
              min={1}
              max={180}
              placeholder={t("minutesPerDay")}
              aria-label={t("minutesPerDay")}
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="rounded-md border-[1.5px] border-border bg-surface px-3.5 py-3 text-[14.5px] text-text"
            />
          )}
        </div>
        <ContinueButton testId="time-continue" disabled={!effectiveMinutes || effectiveMinutes < 1} onClick={goToExperience} />
      </OnboardingStep>
    );
  }

  if (phase === "experience") {
    return (
      <OnboardingStep
        step={3}
        title={t("experienceTitle")}
        subtitle={t("experienceSubtitle")}
      >
        <div role="radiogroup" aria-label={t("experienceTitle")} className="flex flex-col gap-3">
          {EXPERIENCE_OPTIONS.map((id) => (
            <OptionRow
              key={id}
              testId={`experience-${id}`}
              selected={experienceLevel === id}
              label={t(`experience.${id}.label`)}
              note={t(`experience.${id}.note`)}
              onClick={() => setExperienceLevel(id)}
            />
          ))}
        </div>
        <ContinueButton testId="experience-continue" label={t("continueToCalibration")} disabled={!experienceLevel} onClick={goToCalibration} />
      </OnboardingStep>
    );
  }

  if (phase === "calibration") {
    return <CalibrationBattery onDone={onCalibrationDone} />;
  }

  if (phase === "recommend" || phase === "submitting") {
    return (
      <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
        <div className="mb-6 text-center">
          <div className="font-display text-[22px] font-bold text-text">{t("recommendTitle")}</div>
        </div>
        <div role="radiogroup" aria-label={t("recommendLabel")} className="flex flex-col gap-2.5">
          {DIFFICULTY_OPTIONS.map((id) => (
            <OptionRow
              key={id}
              testId={`difficulty-${id}`}
              selected={difficultyLevel === id}
              label={t(`levels.${id}.label`)}
              note={t(`levels.${id}.note`)}
              onClick={() => setDifficultyLevel(id)}
            />
          ))}
        </div>
        {submitError && <div className="mt-3 text-[13px] text-caution">{submitError}</div>}
        <ContinueButton
          testId="finish-onboarding"
          label={phase === "submitting" ? t("saving") : t("startTraining")}
          disabled={phase === "submitting"}
          onClick={finishOnboarding}
        />
      </div>
    );
  }

  return null;
}

function OnboardingStep({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <div className="mb-7 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
      <div className="mb-2.5 text-[12.5px] font-bold tracking-wide text-text-3">{t("stepOf", { step, total: 3 })}</div>
      <h1 className="mb-2 font-display text-[25px] font-bold leading-tight text-text">{title}</h1>
      <div className="mb-6 text-sm leading-relaxed text-text-2">{subtitle}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function OptionRow({
  testId,
  selected,
  label,
  note,
  onClick,
}: {
  testId: string;
  selected: boolean;
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testId}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between rounded-md border-[1.5px] px-4 py-3.5 text-left transition-transform duration-micro active:scale-[0.98]"
      style={{
        borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
        background: selected ? "var(--color-accent-soft)" : "var(--color-surface)",
      }}
    >
      <div>
        <div className="text-[14.5px] font-bold text-text">{label}</div>
        {note && <div className="mt-0.5 text-[12.5px] text-text-2">{note}</div>}
      </div>
      <div
        className="h-5 w-5 flex-shrink-0 rounded-full border-2"
        style={{ borderColor: selected ? "var(--color-accent)" : "var(--color-border)" }}
      />
    </button>
  );
}

function ContinueButton({
  testId,
  label,
  disabled,
  onClick,
}: {
  testId: string;
  label?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("onboarding");
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="mt-5 w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent transition-transform duration-micro active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
    >
      {label ?? t("continue")}
    </button>
  );
}

// ---------- Calibration battery ----------

type CalibrationSubPhase =
  | "spatial-study"
  | "spatial-tap"
  | "nback-stim"
  | "complexspan-memory"
  | "complexspan-recall"
  | "reading-passage"
  | "reading-question";

/**
 * One continuous async loop driving all 6 questions, exactly like each
 * exercise's own run() effect (see e.g. ComplexSpanExercise) — a click
 * handler only ever resolves the one pending promise the loop is
 * awaiting; every task-mutating call and every performance.now() lives
 * inside this effect, never in a plain render-body function, which is
 * what the earlier per-round-component version got wrong (it tripped
 * react-hooks/set-state-in-effect, react-hooks/purity, and
 * react-hooks/refs — restructured to this single-loop shape instead of
 * suppressing those lints).
 */
function CalibrationBattery({ onDone }: { onDone: (results: CalibrationTally[]) => void }) {
  const t = useTranslations("onboarding.calibration");
  const [subPhase, setSubPhase] = useState<CalibrationSubPhase>("spatial-study");
  const [questionNumber, setQuestionNumber] = useState(1);

  const [spatialHighlight, setSpatialHighlight] = useState<number | null>(null);
  const [spatialTapped, setSpatialTapped] = useState<number[]>([]);
  const [spatialTargetLength, setSpatialTargetLength] = useState(0);
  const spatialTappedRef = useRef<number[]>([]);

  const [nbackPosition, setNbackPosition] = useState<number | null>(null);
  const [nbackScoreable, setNbackScoreable] = useState(false);

  const [memoryLetter, setMemoryLetter] = useState<string | null>(null);
  const [recalled, setRecalled] = useState<string[]>([]);
  const recalledRef = useRef<string[]>([]);

  const [passage, setPassage] = useState<Passage | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const pendingResolveRef = useRef<((value: unknown) => void) | null>(null);
  function waitForInput<T>(): Promise<T> {
    return new Promise<T>((resolve) => {
      pendingResolveRef.current = resolve as (value: unknown) => void;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const spatialTask = new SpatialSequenceTask();
    const nbackTask = new NBackTask({ initialDifficulty: 1, minDifficulty: 1, maxDifficulty: 1 });
    const complexSpanTask = new ComplexSpanTask({ initialDifficulty: 3, minDifficulty: 3, maxDifficulty: 3 });
    // PacedReadingTask's passage order is deterministic (front of the
    // pool first, not random — see paced-reading-task.ts), so a
    // shuffled pool here is what keeps calibration showing a varied
    // passage per user instead of literally the same one every time;
    // the real per-user recency rotation itself is the trained
    // exercise's concern (apps/web/src/lib/reading-passage-rotation.ts),
    // not calibration's, since a user only calibrates once.
    const readingTask = new PacedReadingTask({ passagePool: shuffleArray(READING_PASSAGES) });

    async function run() {
      const results: CalibrationTally[] = [];

      // --- Spatial sequence: 2 rounds (Q1, Q2) ---
      let spatialCorrect = 0;
      for (let round = 0; round < 2; round++) {
        if (cancelled) return;
        setQuestionNumber(round + 1);
        setSubPhase("spatial-study");
        spatialTask.startSequence();
        const length = spatialTask.getCurrentSequenceLength();
        spatialTappedRef.current = [];
        setSpatialTapped([]);
        setSpatialTargetLength(length);
        for (let i = 0; i < length; i++) {
          if (cancelled) return;
          const posn = spatialTask.nextSequenceItem();
          setSpatialHighlight(posn);
          await sleep(700);
          if (cancelled) return;
          setSpatialHighlight(null);
          await sleep(200);
        }
        if (cancelled) return;
        setSubPhase("spatial-tap");
        const tapped = await waitForInput<number[]>();
        if (cancelled) return;
        const outcome = spatialTask.submitRecall(tapped, { timestamp: performance.now() });
        if (outcome.fullyCorrect) spatialCorrect++;
      }
      results.push({ method: "visuospatial-sequence-recall-v0", correct: spatialCorrect, total: 2 });

      // --- N-back at fixed N=1: 1 warm-up + 2 scoreable (Q3, Q4) ---
      setQuestionNumber(3);
      let nbackCorrect = 0;
      let nbackTotal = 0;
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        const stim = nbackTask.nextStimulus();
        setSubPhase("nback-stim");
        setNbackPosition(stim.position);
        setNbackScoreable(stim.isScoreable);
        if (!stim.isScoreable) {
          await sleep(900);
          continue;
        }
        if (nbackTotal === 1) setQuestionNumber(4);
        const said = await waitForInput<boolean>();
        if (cancelled) return;
        const outcome = nbackTask.recordResponse(said, { timestamp: performance.now() });
        if (outcome.scored) {
          nbackTotal++;
          if (outcome.correct) nbackCorrect++;
        }
      }
      results.push({ method: "adaptive-nback-v0", correct: nbackCorrect, total: nbackTotal });

      // --- Complex span as simple span (no processing step): Q5 ---
      setQuestionNumber(5);
      setSubPhase("complexspan-memory");
      complexSpanTask.startSet();
      const setSize = complexSpanTask.getCurrentSetSize();
      for (let i = 0; i < setSize; i++) {
        if (cancelled) return;
        const letter = complexSpanTask.nextMemoryItem();
        setMemoryLetter(letter);
        await sleep(1000);
      }
      if (cancelled) return;
      setMemoryLetter(null);
      recalledRef.current = [];
      setRecalled([]);
      setSubPhase("complexspan-recall");
      const recalledLetters = await waitForInput<string[]>();
      if (cancelled) return;
      const spanOutcome = complexSpanTask.submitRecall(recalledLetters, { timestamp: performance.now() });
      results.push({ method: "complex-span-v0", correct: spanOutcome.fullyCorrect ? 1 : 0, total: 1 });

      // --- One reading passage + comprehension question: Q6 ---
      setQuestionNumber(6);
      setSubPhase("reading-passage");
      const nextPassage = readingTask.nextPassage();
      setPassage(nextPassage);
      const readStart = performance.now();
      await waitForInput<void>();
      if (cancelled) return;
      const elapsedMs = performance.now() - readStart;
      setSubPhase("reading-question");
      const choiceIndex = await waitForInput<number>();
      if (cancelled) return;
      const answeredCorrectly = choiceIndex === nextPassage.question.correctIndex;
      readingTask.recordPassageResult({ answeredCorrectly, elapsedMs, timestamp: performance.now() });
      results.push({ method: "reading-paced-adaptive-v0", correct: answeredCorrectly ? 1 : 0, total: 1 });

      if (!cancelled) onDone(results);
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolvePending(value: unknown) {
    pendingResolveRef.current?.(value);
    pendingResolveRef.current = null;
  }

  function handleSpatialTap(position: number) {
    if (subPhase !== "spatial-tap" || spatialTappedRef.current.includes(position)) return;
    spatialTappedRef.current = [...spatialTappedRef.current, position];
    setSpatialTapped(spatialTappedRef.current);
  }

  function handleComplexSpanTap(letter: string) {
    const setSize = 3;
    if (subPhase !== "complexspan-recall" || recalledRef.current.length >= setSize) return;
    recalledRef.current = [...recalledRef.current, letter];
    setRecalled(recalledRef.current);
  }

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <div className="mb-1 text-[12.5px] font-bold tracking-wide text-text-3">{t("title")}</div>
      <div className="mb-6 text-center">
        <div className="font-display text-lg font-bold text-text">
          {(subPhase === "spatial-study" || subPhase === "spatial-tap") && t("spatial")}
          {subPhase === "nback-stim" && t("nBack")}
          {(subPhase === "complexspan-memory" || subPhase === "complexspan-recall") && t("complexSpan")}
          {(subPhase === "reading-passage" || subPhase === "reading-question") && t("reading")}
        </div>
        <div className="mt-2 text-[13.5px] text-text-2">{t("subtitle")}</div>
      </div>

      {(subPhase === "spatial-study" || subPhase === "spatial-tap") && (
        <div className="flex flex-1 flex-col items-center">
          <CalibrationGrid highlighted={spatialHighlight} tapped={spatialTapped} onTap={handleSpatialTap} disabled={subPhase !== "spatial-tap"} />
          {subPhase === "spatial-tap" && (
            <button
              data-testid="calibration-spatial-submit"
              onClick={() => resolvePending(spatialTappedRef.current)}
              disabled={spatialTapped.length !== spatialTargetLength}
              className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {t("submit")}
            </button>
          )}
        </div>
      )}

      {subPhase === "nback-stim" && (
        <div className="flex flex-1 flex-col items-center">
          <CalibrationGrid highlighted={nbackPosition} tapped={[]} onTap={() => {}} disabled />
          <div className="flex w-full gap-3">
            <button
              data-testid="calibration-nback-no"
              onClick={() => resolvePending(false)}
              disabled={!nbackScoreable}
              className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-3 text-center font-body text-sm font-bold text-text transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {t("different")}
            </button>
            <button
              data-testid="calibration-nback-yes"
              onClick={() => resolvePending(true)}
              disabled={!nbackScoreable}
              className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-3 text-center font-body text-sm font-bold text-text transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {t("same")}
            </button>
          </div>
        </div>
      )}

      {(subPhase === "complexspan-memory" || subPhase === "complexspan-recall") && (
        <div className="flex flex-1 flex-col items-center">
          {subPhase === "complexspan-memory" && memoryLetter && (
            <div data-testid="calibration-memory-letter" className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent font-num text-3xl font-bold text-on-accent">
              {memoryLetter}
            </div>
          )}
          {subPhase === "complexspan-recall" && (
            <>
              <div className="mb-4 flex gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex h-9 w-9 items-center justify-center rounded-md border-[1.5px] border-border font-num text-sm font-bold text-text">
                    {recalled[i] ?? ""}
                  </div>
                ))}
              </div>
              <div className="mb-4 grid grid-cols-7 gap-1.5">
                {RECALL_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    data-testid={`calibration-recall-key-${letter}`}
                    onClick={() => handleComplexSpanTap(letter)}
                    disabled={recalled.length >= 3}
                    className="rounded-md border border-border bg-surface py-2 font-num text-sm font-bold text-text transition-transform duration-micro active:scale-90 disabled:opacity-40 disabled:active:scale-100"
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <button
                data-testid="calibration-complexspan-submit"
                onClick={() => resolvePending(recalledRef.current)}
                disabled={recalled.length !== 3}
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                {t("submit")}
              </button>
            </>
          )}
        </div>
      )}

      {(subPhase === "reading-passage" || subPhase === "reading-question") && passage && (
        <div className="flex flex-1 flex-col">
          {subPhase === "reading-passage" ? (
            <>
              <div lang="en" className="mb-4 max-h-64 overflow-y-auto text-[14.5px] leading-relaxed text-text-2">{passage.text}</div>
              <button
                data-testid="calibration-finish-reading"
                onClick={() => resolvePending(undefined)}
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95"
              >
                {t("finishedReading")}
              </button>
            </>
          ) : (
            <>
              <div data-testid="calibration-question-prompt" lang="en" className="mb-4 font-display text-base font-bold text-text">
                {passage.question.prompt}
              </div>
              <div role="radiogroup" aria-label={passage.question.prompt} lang="en" className="mb-4 flex flex-col gap-2">
                {passage.question.choices.map((choice, i) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedChoice === i}
                    key={i}
                    data-testid={`calibration-answer-choice-${i}`}
                    onClick={() => setSelectedChoice(i)}
                    className="w-full cursor-pointer rounded-md border-[1.5px] px-3.5 py-3 text-left text-[13.5px] transition-transform duration-micro active:scale-[0.98]"
                    style={{
                      borderColor: selectedChoice === i ? "var(--color-accent)" : "var(--color-border)",
                      background: selectedChoice === i ? "var(--color-accent-soft)" : "var(--color-surface)",
                    }}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <button
                data-testid="calibration-submit-answer"
                onClick={() => selectedChoice !== null && resolvePending(selectedChoice)}
                disabled={selectedChoice === null}
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent transition-transform duration-micro active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                {t("submit")}
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-text-3">
          <span>{t("questionOf", { current: questionNumber, total: 6 })}</span>
          <span>{t("bothCount")}</span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(questionNumber / 6) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function CalibrationGrid({ highlighted, tapped, onTap, disabled }: { highlighted: number | null; tapped: number[]; onTap: (i: number) => void; disabled: boolean }) {
  return (
    <div className="mb-6 grid w-[220px] grid-cols-3 gap-3">
      <div data-testid="calibration-highlighted-cell" className="hidden">
        {highlighted !== null ? highlighted : ""}
      </div>
      {Array.from({ length: 9 }, (_, i) => {
        const isHighlighted = highlighted === i;
        const order = tapped.indexOf(i);
        return (
          <button
            key={i}
            type="button"
            data-testid={`calibration-grid-cell-${i}`}
            onClick={() => onTap(i)}
            disabled={disabled}
            className="flex aspect-square items-center justify-center rounded-md border-[1.5px] font-num text-sm font-bold transition-transform duration-micro active:scale-90 disabled:active:scale-100"
            style={{
              background: isHighlighted || order >= 0 ? "var(--color-accent)" : "var(--color-surface)",
              borderColor: isHighlighted || order >= 0 ? "var(--color-accent)" : "var(--color-border)",
              color: "var(--color-on-accent)",
            }}
          >
            {order >= 0 ? order + 1 : ""}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NBackTask,
  ComplexSpanTask,
  SpatialSequenceTask,
} from "@lean-academy/cognitive-engine";
import { PacedReadingTask, type Passage } from "@lean-academy/reading-engine";

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

const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: "working-memory", label: "Improve working memory" },
  { id: "concentration", label: "Practice concentration" },
  { id: "reading-efficiency", label: "Read faster, without losing the plot" },
  { id: "memory-strategies", label: "Learn better memory strategies" },
  { id: "habit", label: "Just build a daily habit" },
  { id: "balanced", label: "A bit of everything" },
];

const TIME_OPTIONS = [
  { minutes: 5, label: "5 minutes", note: "A quick daily touch" },
  { minutes: 10, label: "10 minutes", note: "Balanced, most popular" },
  { minutes: 15, label: "15 minutes", note: "More structured training" },
  { minutes: 20, label: "20 minutes", note: "For focused daily practice" },
];

const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string; note: string }[] = [
  { id: "new", label: "New to this", note: "Start comfortable and build up" },
  { id: "some", label: "Some experience", note: "I've tried memory or brain-training apps" },
  { id: "experienced", label: "Very experienced", note: "I want a real challenge from the start" },
];

const DIFFICULTY_OPTIONS: { id: DifficultyLevel; label: string; note: string }[] = [
  { id: "BEGINNER", label: "Beginner", note: "Start at the easiest end of each exercise" },
  { id: "INTERMEDIATE", label: "Intermediate", note: "A typical comfortable starting point" },
  { id: "ADVANCED", label: "Advanced", note: "Skip ahead, closer to each exercise's hardest end" },
  { id: "EXPERT", label: "Expert", note: "Start at the hardest end of each exercise" },
  { id: "AUTO", label: "Auto (recommended)", note: "Use exactly what your calibration measured" },
];

const RECALL_LETTERS = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      setSubmitError("Something went wrong saving your plan. You can try again.");
      setPhase("recommend");
    }
  }

  if (phase === "goals") {
    return (
      <OnboardingStep step={1} title="What would you like to focus on?" subtitle="Pick what matters most. We'll build your plan around it — you can always train everything either way.">
        <div role="radiogroup" aria-label="What would you like to focus on?" className="flex flex-col gap-2.5">
          {GOAL_OPTIONS.map((opt) => (
            <OptionRow key={opt.id} testId={`goal-${opt.id}`} selected={goal === opt.id} label={opt.label} onClick={() => setGoal(opt.id)} />
          ))}
        </div>
        <ContinueButton testId="goals-continue" disabled={!goal} onClick={goToTime} />
      </OnboardingStep>
    );
  }

  if (phase === "time") {
    return (
      <OnboardingStep step={2} title="How much time can you give each day?" subtitle="We'll build sessions to fit. You can change this anytime.">
        <div role="radiogroup" aria-label="How much time can you give each day?" className="flex flex-col gap-3">
          {TIME_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.minutes}
              testId={`time-${opt.minutes}`}
              selected={!isCustomTime && dailyMinutes === opt.minutes}
              label={opt.label}
              note={opt.note}
              onClick={() => {
                setIsCustomTime(false);
                setDailyMinutes(opt.minutes);
              }}
            />
          ))}
          <OptionRow
            testId="time-custom"
            selected={isCustomTime}
            label="Custom"
            note="Set your own goal"
            onClick={() => setIsCustomTime(true)}
          />
          {isCustomTime && (
            <input
              data-testid="custom-minutes-input"
              type="number"
              min={1}
              max={180}
              placeholder="Minutes per day"
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
        title="Have you done anything like this before?"
        subtitle="No wrong answer — this just helps your first sessions feel right. A short calibration next will fine-tune it further."
      >
        <div role="radiogroup" aria-label="Have you done anything like this before?" className="flex flex-col gap-3">
          {EXPERIENCE_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.id}
              testId={`experience-${opt.id}`}
              selected={experienceLevel === opt.id}
              label={opt.label}
              note={opt.note}
              onClick={() => setExperienceLevel(opt.id)}
            />
          ))}
        </div>
        <ContinueButton testId="experience-continue" label="Continue to calibration" disabled={!experienceLevel} onClick={goToCalibration} />
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
          <div className="font-display text-[22px] font-bold text-text">We recommend starting at:</div>
        </div>
        <div role="radiogroup" aria-label="Recommended difficulty level" className="flex flex-col gap-2.5">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <OptionRow
              key={opt.id}
              testId={`difficulty-${opt.id}`}
              selected={difficultyLevel === opt.id}
              label={opt.label}
              note={opt.note}
              onClick={() => setDifficultyLevel(opt.id)}
            />
          ))}
        </div>
        {submitError && <div className="mt-3 text-[13px] text-caution">{submitError}</div>}
        <ContinueButton
          testId="finish-onboarding"
          label={phase === "submitting" ? "Saving your plan..." : "Start training"}
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
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <div className="mb-7 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-accent" : "bg-surface-2"}`} />
        ))}
      </div>
      <div className="mb-2.5 text-[12.5px] font-bold tracking-wide text-text-3">STEP {step} OF 3</div>
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
      className="flex w-full cursor-pointer items-center justify-between rounded-md border-[1.5px] px-4 py-3.5 text-left"
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
  label = "Continue",
  disabled,
  onClick,
}: {
  testId: string;
  label?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="mt-5 w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent disabled:opacity-40"
    >
      {label}
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
    const readingTask = new PacedReadingTask();

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
      <div className="mb-1 text-[12.5px] font-bold tracking-wide text-text-3">QUICK CALIBRATION</div>
      <div className="mb-6 text-center">
        <div className="font-display text-lg font-bold text-text">
          {(subPhase === "spatial-study" || subPhase === "spatial-tap") && "Watch, then repeat the pattern"}
          {subPhase === "nback-stim" && "Was this the same square as last time?"}
          {(subPhase === "complexspan-memory" || subPhase === "complexspan-recall") && "Remember the letters, in order"}
          {(subPhase === "reading-passage" || subPhase === "reading-question") && "Read at your own pace"}
        </div>
        <div className="mt-2 text-[13.5px] text-text-2">About 90 seconds, no pass or fail — this just helps us start you at the right level.</div>
      </div>

      {(subPhase === "spatial-study" || subPhase === "spatial-tap") && (
        <div className="flex flex-1 flex-col items-center">
          <CalibrationGrid highlighted={spatialHighlight} tapped={spatialTapped} onTap={handleSpatialTap} disabled={subPhase !== "spatial-tap"} />
          {subPhase === "spatial-tap" && (
            <button
              data-testid="calibration-spatial-submit"
              onClick={() => resolvePending(spatialTappedRef.current)}
              disabled={spatialTapped.length !== spatialTargetLength}
              className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent disabled:opacity-40"
            >
              Submit
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
              className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-3 text-center font-body text-sm font-bold text-text disabled:opacity-40"
            >
              Different
            </button>
            <button
              data-testid="calibration-nback-yes"
              onClick={() => resolvePending(true)}
              disabled={!nbackScoreable}
              className="flex-1 rounded-md border-[1.5px] border-border bg-surface py-3 text-center font-body text-sm font-bold text-text disabled:opacity-40"
            >
              Same
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
                    className="rounded-md border border-border bg-surface py-2 font-num text-sm font-bold text-text disabled:opacity-40"
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <button
                data-testid="calibration-complexspan-submit"
                onClick={() => resolvePending(recalledRef.current)}
                disabled={recalled.length !== 3}
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent disabled:opacity-40"
              >
                Submit
              </button>
            </>
          )}
        </div>
      )}

      {(subPhase === "reading-passage" || subPhase === "reading-question") && passage && (
        <div className="flex flex-1 flex-col">
          {subPhase === "reading-passage" ? (
            <>
              <div className="mb-4 max-h-64 overflow-y-auto text-[14.5px] leading-relaxed text-text-2">{passage.text}</div>
              <button
                data-testid="calibration-finish-reading"
                onClick={() => resolvePending(undefined)}
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent"
              >
                I&rsquo;ve finished reading
              </button>
            </>
          ) : (
            <>
              <div data-testid="calibration-question-prompt" className="mb-4 font-display text-base font-bold text-text">
                {passage.question.prompt}
              </div>
              <div role="radiogroup" aria-label={passage.question.prompt} className="mb-4 flex flex-col gap-2">
                {passage.question.choices.map((choice, i) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedChoice === i}
                    key={i}
                    data-testid={`calibration-answer-choice-${i}`}
                    onClick={() => setSelectedChoice(i)}
                    className="w-full cursor-pointer rounded-md border-[1.5px] px-3.5 py-3 text-left text-[13.5px]"
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
                className="w-full rounded-full bg-accent py-3 text-center font-body text-sm font-bold text-on-accent disabled:opacity-40"
              >
                Submit
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-text-3">
          <span>Question {questionNumber} of 6</span>
          <span>Memory &amp; comprehension both count</span>
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
            className="flex aspect-square items-center justify-center rounded-md border-[1.5px] font-num text-sm font-bold"
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

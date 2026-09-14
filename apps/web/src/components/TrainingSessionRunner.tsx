"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NBackExercise } from "./NBackExercise";
import { ComplexSpanExercise } from "./ComplexSpanExercise";
import { SpatialSequenceExercise } from "./SpatialSequenceExercise";
import { PacedReadingExercise } from "./PacedReadingExercise";
import type { ExerciseSessionOutcome, SessionModeProps } from "@/lib/session-types";
import type { TodaysExercise } from "@/lib/todays-training";

// Implements docs/kanban.md's Session orchestration card: strings the
// day's exercises together without returning to a menu between them
// (prototype/Home.dc.html's "Start Training" -> exercise -> transition
// -> exercise -> ... -> prototype/SessionComplete.dc.html), rather than
// each exercise's standalone /train/<exercise> route (which still works
// unchanged — see each component's own SessionModeProps default).
//
// Each exercise component already fully owns its own task logic; this
// only sequences them and persists what they hand back via onComplete —
// see apps/web/src/lib/session-types.ts for that shared shape.

const EXERCISE_COMPONENTS: Record<string, React.ComponentType<SessionModeProps>> = {
  "adaptive-nback-v0": NBackExercise,
  "complex-span-v0": ComplexSpanExercise,
  "visuospatial-sequence-recall-v0": SpatialSequenceExercise,
  "reading-paced-adaptive-v0": PacedReadingExercise,
};

const DOMAIN_LABELS: Record<string, string> = {
  WORKING_MEMORY: "Working Memory",
  READING: "Reading",
  SPATIAL: "Spatial Memory",
};

const DOMAIN_COLOR_CLASS: Record<string, string> = {
  WORKING_MEMORY: "wm",
  READING: "reading",
  SPATIAL: "spatial",
};

const TRANSITION_MS = 1800;

type Phase = "exercise" | "transition" | "complete";

export function TrainingSessionRunner({ exercises }: { exercises: TodaysExercise[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("exercise");
  const [summaries, setSummaries] = useState<ExerciseSessionOutcome[]>([]);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    fetch("/api/training-sessions", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        sessionIdRef.current = data.id;
      })
      .catch((err) => console.error("Failed to start training session:", err));
  }, []);

  useEffect(() => {
    if (phase !== "transition") return;
    const t = setTimeout(() => {
      setIndex((i) => i + 1);
      setPhase("exercise");
    }, TRANSITION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  function persistExercise(outcome: ExerciseSessionOutcome) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    fetch(`/api/training-sessions/${sessionId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome),
    }).catch((err) => console.error("Failed to persist exercise trials:", err));
  }

  function persistCompletion(durationSeconds: number) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    fetch(`/api/training-sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDurationSeconds: durationSeconds }),
    }).catch((err) => console.error("Failed to mark training session complete:", err));
  }

  function handleExerciseComplete(outcome: ExerciseSessionOutcome) {
    setSummaries((prev) => [...prev, outcome]);
    persistExercise(outcome);
    if (index + 1 < exercises.length) {
      setPhase("transition");
    } else {
      const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      setTotalDurationSeconds(durationSeconds);
      persistCompletion(durationSeconds);
      setPhase("complete");
    }
  }

  if (phase === "complete") {
    return (
      <SessionCompleteScreen
        summaries={summaries}
        exercises={exercises}
        totalMinutes={Math.max(1, Math.round(totalDurationSeconds / 60))}
      />
    );
  }

  if (phase === "transition") {
    const next = exercises[index + 1];
    return (
      <div className="flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-6 py-7 text-center">
        <div className="mb-2 font-display text-xl font-bold text-text">Nice work</div>
        <div className="text-[14px] text-text-2">Next up: {DOMAIN_LABELS[next.domain] ?? next.displayName}</div>
      </div>
    );
  }

  const current = exercises[index];
  const ExerciseComponent = EXERCISE_COMPONENTS[current.method];
  if (!ExerciseComponent) {
    return (
      <div className="flex w-full max-w-[390px] flex-1 flex-col items-center justify-center px-6 py-7 text-center">
        <div className="text-sm text-text-2">Unknown exercise: {current.method}</div>
        <Link href="/" className="mt-4 text-sm font-semibold text-accent underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <ExerciseComponent
      key={`${index}-${current.method}`}
      initialDifficulty={current.initialDifficulty}
      onComplete={handleExerciseComplete}
    />
  );
}

function SessionCompleteScreen({
  summaries,
  exercises,
  totalMinutes,
}: {
  summaries: ExerciseSessionOutcome[];
  exercises: TodaysExercise[];
  totalMinutes: number;
}) {
  const displayNameByMethod = new Map(exercises.map((e) => [e.method, e]));

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-7">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-accent-soft">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"
              stroke="var(--color-accent)"
              strokeWidth="1.4"
              fill="var(--color-accent)"
              fillOpacity="0.15"
            />
          </svg>
        </div>
        <div className="font-display text-[25px] font-bold text-text">Session complete</div>
        <div className="mt-1.5 text-[13.5px] text-text-2">
          {totalMinutes} minute{totalMinutes === 1 ? "" : "s"} · {summaries.length} exercise{summaries.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface px-5 py-1 shadow-sm">
        {summaries.map((s, i) => {
          const exercise = displayNameByMethod.get(s.method);
          const colorKey = exercise ? DOMAIN_COLOR_CLASS[exercise.domain] : "accent";
          return (
            <div
              key={s.method}
              className={`flex items-center gap-3 py-3 ${i < summaries.length - 1 ? "border-b border-border" : ""}`}
            >
              <div
                className="h-[26px] w-[26px] flex-shrink-0 rounded-md"
                style={{ background: `var(--color-${colorKey}-soft)` }}
              />
              <div className="flex-1 text-[13.5px] font-semibold text-text">
                {exercise?.displayName ?? s.method}
              </div>
              <div className="font-num text-[13.5px] font-semibold text-text-2">{s.summaryLabel}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-auto" />

      <Link
        href="/"
        className="mt-6 block w-full rounded-full bg-accent py-3.5 text-center font-body text-[15px] font-bold text-on-accent"
      >
        Done
      </Link>
    </div>
  );
}

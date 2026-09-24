"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { AdvancedMethod } from "@/lib/advanced-settings";

// The Advanced tab's own lesson history (AdvancedRun rows) — shared by
// /advanced (every method) and /advanced/<slug> (one method). Reading
// rows always pair WPM with comprehension, never WPM alone (CLAUDE.md's
// content rules).

export interface AdvancedRunView {
  id: string;
  method: AdvancedMethod;
  trialCount: number;
  correctCount: number;
  startLevel: number;
  endLevel: number;
  averageWpm: number | null;
  createdAt: string;
}

export const METHOD_COLOR: Record<AdvancedMethod, string> = {
  "adaptive-nback-v0": "wm",
  "complex-span-v0": "wm",
  "dice-sum-v0": "wm",
  "visuospatial-sequence-recall-v0": "spatial",
  "reading-paced-adaptive-v0": "reading",
};

export function useExerciseName() {
  const tm = useTranslations("methods");
  return (method: string) => (tm.has(method as never) ? tm(method as never) : method);
}

export function AdvancedRunList({ runs, showMethod }: { runs: AdvancedRunView[]; showMethod: boolean }) {
  const t = useTranslations("advanced");
  const format = useFormatter();
  const exerciseName = useExerciseName();

  if (runs.length === 0) {
    return <div className="rounded-lg border border-border bg-surface px-4.5 py-4 text-[13px] text-text-3">{showMethod ? t("noRuns") : t("noRunsForExercise")}</div>;
  }

  return (
    <ul className="rounded-lg border border-border bg-surface px-4.5 shadow-sm" data-testid="advanced-run-list">
      {runs.map((run) => {
        const pct = run.trialCount > 0 ? Math.round((run.correctCount / run.trialCount) * 100) : 0;
        const isReading = run.method === "reading-paced-adaptive-v0";
        return (
          <li key={run.id} data-testid="advanced-run" className="flex items-center gap-3 border-b border-border py-3 last:border-0">
            <div
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: `var(--color-${METHOD_COLOR[run.method]})` }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              {showMethod ? <div className="truncate text-[13.5px] font-bold text-text">{exerciseName(run.method)}</div> : null}
              <div className="text-[12.5px] text-text-2">
                {isReading
                  ? t("readingRunSummary", { wpm: Math.round(run.averageWpm ?? 0), comprehension: pct })
                  : t("runSummary", { accuracy: pct, trials: run.trialCount, start: run.startLevel, end: run.endLevel })}
              </div>
            </div>
            <div className="flex-shrink-0 text-[11.5px] text-text-3">
              {format.dateTime(new Date(run.createdAt), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

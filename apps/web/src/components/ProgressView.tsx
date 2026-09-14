"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProgressData, TrainedTaskProgress } from "@/lib/progress-data";

// Built against prototype/Progress.dc.html. Two honest departures from
// the mockup's specific example content:
//
// - "Similar tasks" (near transfer) shows a real "not measured yet"
//   state instead of the mockup's fabricated result narrative — no
//   near-transfer assessment mechanic exists yet (see docs/kanban.md;
//   only the onboarding BASELINE calibration exists so far), so showing
//   the mockup's specific "score improved" story would be inventing
//   data no real user has.
// - "Broader transfer" is copied close to verbatim from the mockup —
//   it's already an honest static disclaimer, not a data display, so
//   there was nothing to make more real.

type Tab = "trained" | "similar" | "broader";

export function ProgressView({ data }: { data: ProgressData }) {
  const [tab, setTab] = useState<Tab>("trained");

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-5 font-display text-[22px] font-bold text-text">Progress</h1>

      {!data.hasAnyData ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <div className="mb-3 text-sm text-text-2">
            Nothing trained yet. Complete a training session to start seeing real progress here.
          </div>
          <Link
            href="/"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            Back home
          </Link>
        </div>
      ) : (
        <>
          {data.reading?.hasComparison && (
            <div className="mb-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="mb-3.5 text-[12px] font-bold tracking-wide text-text-3">READING — LAST 30 DAYS</div>
              <div className="flex gap-7">
                <div>
                  <div className="mb-0.5 text-[11px] text-text-3">PACE</div>
                  <div className="font-num text-2xl font-bold text-text">
                    {data.reading.startWpm} → {data.reading.endWpm}{" "}
                    <span className="font-body text-xs font-normal text-text-2">WPM</span>
                  </div>
                </div>
                <div>
                  <div className="mb-0.5 text-[11px] text-text-3">COMPREHENSION</div>
                  <div className="font-num text-2xl font-bold text-success">
                    {data.reading.startComprehensionPct}% → {data.reading.endComprehensionPct}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1">
            {(["trained", "similar", "broader"] as const).map((t) => (
              <button
                key={t}
                data-testid={`progress-tab-${t}`}
                onClick={() => setTab(t)}
                className="flex-1 rounded-full py-2.5 text-center text-[12.5px] font-bold transition-transform duration-micro active:scale-95"
                style={
                  tab === t
                    ? { background: "var(--color-surface)", color: "var(--color-text)" }
                    : { color: "var(--color-text-2)" }
                }
              >
                {t === "trained" ? "Trained" : t === "similar" ? "Similar tasks" : "Broader transfer"}
              </button>
            ))}
          </div>

          {tab === "trained" &&
            (data.trainedTasks.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-5 text-sm text-text-2 shadow-sm">
                No other trained tasks yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.trainedTasks.map((task) => (
                  <TrainedTaskCard key={task.method} task={task} />
                ))}
              </div>
            ))}

          {tab === "similar" && (
            <>
              <div className="mb-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
                <div className="mb-1.5 text-[13.5px] font-bold text-text">No near-transfer assessment yet</div>
                <div className="text-[12.5px] leading-relaxed text-text-2">
                  A short periodic assessment using a task you haven&rsquo;t practiced directly, sharing the same
                  underlying mechanism as one of your trained tasks, will appear here once you&rsquo;ve taken one.
                </div>
              </div>
              <div className="px-1 text-xs leading-relaxed text-text-3">
                Measured periodically, not every session, to avoid pure practice effects.
              </div>
            </>
          )}

          {tab === "broader" && (
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="mb-2 text-[13.5px] font-bold text-text">Not yet measured</div>
              <div className="text-[12.5px] leading-relaxed text-text-2">
                Broader transfer — to general intelligence, memory in daily life, or unrelated tasks — isn&rsquo;t
                established in current research for these exercises. We won&rsquo;t show a number here until
                there&rsquo;s real evidence behind it.
              </div>
              <Link href="/train/n-back" className="mt-3.5 block text-[12.5px] font-bold text-accent">
                See the research →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrainedTaskCard({ task }: { task: TrainedTaskProgress }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13.5px] font-bold text-text">{task.displayName}</div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}
        >
          {task.evidenceBadge}
        </span>
      </div>
      <div className="mb-2.5 text-xs text-text-2">{task.progressLabel}</div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(task.progressFraction * 100)}%` }} />
      </div>
    </div>
  );
}

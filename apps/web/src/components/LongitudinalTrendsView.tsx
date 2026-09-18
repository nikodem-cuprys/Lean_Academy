"use client";

import Link from "next/link";
import type { TaskTrend, ReadingTrend } from "@/lib/trend-data";
import { TrendChart } from "@/components/TrendChart";

// minSessions/minSpanDays are passed in as plain numbers from the
// server-component page rather than imported from
// apps/web/src/lib/trend-data.ts directly — that module also imports
// the (server-only) Prisma client, and this is a "use client" component,
// so a runtime import of even one of its constants would bundle Prisma
// into client JS. Same reason ProgressView.tsx keeps its own local copy
// of near-transfer-assessment.ts's display labels instead of importing
// that module. `import type` above is compile-time-only and safe.

// Phase 6's "Longitudinal trend view" card (docs/kanban.md) — a real,
// multi-point time series per trained task, built specifically for a
// premium account (see apps/web/src/app/progress/trends/page.tsx's
// gate) since docs/monetization-plan.md lists "deeper statistics" as a
// premium feature and the free Progress page already shows a real (if
// simpler) 30-day before/after snapshot of the same underlying data. No
// prototype/*.dc.html artboard exists for this screen (checked) — built
// to match ProgressView's established card shell (rounded-lg border
// shadow-sm) rather than inventing a new visual pattern, same departure
// documented on the Weekly Challenges/Achievements cards.
//
// Each task's own real min/max range is honored as its own y-axis (see
// TrendChart) rather than a single shared axis across tasks of
// different scale — combining N-Back's difficulty with Complex Span's
// set size on one chart would be exactly the "two measures, different
// scale -> one axis" anti-pattern the dataviz skill warns against, so
// this renders one small-multiple chart per task instead. Reading's WPM
// and comprehension are the same kind of mismatch (different units and
// ranges) and get the same treatment — two charts, not a dual y-axis —
// but grouped in one bordered section so they always read as a pair,
// never WPM shown without its comprehension partner in view, per this
// project's non-negotiable content rule.

function formatTaskValue(method: string) {
  if (method === "complex-span-v0") return (v: number) => `${v}-item span`;
  return (v: number) => `Level ${v}`;
}

const DOMAIN_COLOR: Record<TaskTrend["domain"], string> = {
  WORKING_MEMORY: "var(--color-wm)",
  SPATIAL: "var(--color-spatial)",
  READING: "var(--color-reading)",
};

function NotEnoughDataCard({
  sessionCount,
  spanDays,
  label,
  testId,
  minSessions,
  minSpanDays,
}: {
  sessionCount: number;
  spanDays: number;
  label: string;
  testId: string;
  minSessions: number;
  minSpanDays: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 text-[12.5px] text-text-2 shadow-sm" data-testid={testId}>
      <div className="mb-1 font-bold text-text">{label}</div>
      Not enough data for a meaningful trend yet — {sessionCount} of {minSessions} sessions, spanning {spanDays} of
      the {minSpanDays} days a real trend needs. A handful of sessions in a couple of days would draw a
      technically-real but misleading line, so this waits until there&rsquo;s enough spread-out history.
    </div>
  );
}

function TaskTrendSection({ trend, minSessions, minSpanDays }: { trend: TaskTrend; minSessions: number; minSpanDays: number }) {
  if (!trend.hasEnoughData) {
    return (
      <NotEnoughDataCard
        sessionCount={trend.sessionCount}
        spanDays={trend.spanDays}
        label={trend.displayName}
        testId={`trend-not-enough-data-${trend.method}`}
        minSessions={minSessions}
        minSpanDays={minSpanDays}
      />
    );
  }
  return (
    <TrendChart
      title={`${trend.displayName} — difficulty over time`}
      points={trend.points}
      color={DOMAIN_COLOR[trend.domain]}
      min={trend.min}
      max={trend.max}
      formatValue={formatTaskValue(trend.method)}
      testId={`trend-${trend.method}`}
    />
  );
}

function ReadingTrendSection({ trend, minSessions, minSpanDays }: { trend: ReadingTrend; minSessions: number; minSpanDays: number }) {
  if (!trend.hasEnoughData) {
    return (
      <NotEnoughDataCard
        sessionCount={trend.sessionCount}
        spanDays={trend.spanDays}
        label="Reading"
        testId="trend-not-enough-data-reading"
        minSessions={minSessions}
        minSpanDays={minSpanDays}
      />
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3" data-testid="trend-reading-section">
      <div className="mb-2 px-1 text-[11px] font-bold tracking-wide text-text-3">
        READING — PACE AND COMPREHENSION OVER TIME
      </div>
      <div className="flex flex-col gap-3">
        {/* min=0/max=0: real measured WPM has a natural floor (never
            negative) but no fixed ceiling the way an internal difficulty
            range does — TrendChart's own Math.max(max, ...data) then
            derives the real ceiling purely from the data. */}
        <TrendChart
          title="Pace"
          points={trend.wpmPoints}
          color="var(--color-reading)"
          min={0}
          max={0}
          formatValue={(v) => `${v} WPM`}
          testId="trend-reading-wpm"
        />
        <TrendChart
          title="Comprehension"
          points={trend.comprehensionPoints}
          color="var(--color-success)"
          min={0}
          max={100}
          formatValue={(v) => `${v}%`}
          testId="trend-reading-comprehension"
        />
      </div>
    </div>
  );
}

export function LongitudinalTrendsView({
  taskTrends,
  reading,
  minSessions,
  minSpanDays,
}: {
  taskTrends: TaskTrend[];
  reading: ReadingTrend | null;
  minSessions: number;
  minSpanDays: number;
}) {
  const hasAnyData = taskTrends.length > 0 || reading !== null;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-1 font-display text-[22px] font-bold text-text">Long-term trends</h1>
      <div className="mb-5 text-[12.5px] text-text-2">
        Your real training history over time, one chart per task — not just a before/after snapshot.
      </div>

      {!hasAnyData ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <div className="mb-3 text-sm text-text-2">
            Nothing trained yet. Complete a few training sessions to start building a real trend here.
          </div>
          <Link
            href="/progress"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            Back to Progress
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {taskTrends.map((trend) => (
            <TaskTrendSection key={trend.method} trend={trend} minSessions={minSessions} minSpanDays={minSpanDays} />
          ))}
          {reading && <ReadingTrendSection trend={reading} minSessions={minSessions} minSpanDays={minSpanDays} />}
          <Link href="/progress" className="mt-2 text-center text-[12.5px] font-bold text-accent">
            Back to Progress
          </Link>
        </div>
      )}
    </div>
  );
}

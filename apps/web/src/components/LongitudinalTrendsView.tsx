"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("trends");
  return (
    <div className="rounded-lg border border-border bg-surface p-5 text-[12.5px] text-text-2 shadow-sm" data-testid={testId}>
      <div className="mb-1 font-bold text-text">{label}</div>
      {t("notEnoughData", { sessionCount, minSessions, spanDays, minSpanDays })}
    </div>
  );
}

function TaskTrendSection({ trend, minSessions, minSpanDays }: { trend: TaskTrend; minSessions: number; minSpanDays: number }) {
  const t = useTranslations("trends");
  const tp = useTranslations("progress");
  const tm = useTranslations("methods");
  const name = tm.has(trend.method as never) ? tm(trend.method as never) : trend.displayName;
  const formatValue =
    trend.method === "complex-span-v0"
      ? (v: number) => tp("bestSpan", { value: v })
      : (v: number) => tp("bestLevel", { value: v });
  if (!trend.hasEnoughData) {
    return (
      <NotEnoughDataCard
        sessionCount={trend.sessionCount}
        spanDays={trend.spanDays}
        label={name}
        testId={`trend-not-enough-data-${trend.method}`}
        minSessions={minSessions}
        minSpanDays={minSpanDays}
      />
    );
  }
  return (
    <TrendChart
      title={t("difficultyOverTime", { name })}
      points={trend.points}
      color={DOMAIN_COLOR[trend.domain]}
      min={trend.min}
      max={trend.max}
      formatValue={formatValue}
      testId={`trend-${trend.method}`}
    />
  );
}

function ReadingTrendSection({ trend, minSessions, minSpanDays }: { trend: ReadingTrend; minSessions: number; minSpanDays: number }) {
  const t = useTranslations("trends");
  const td = useTranslations("domains");
  if (!trend.hasEnoughData) {
    return (
      <NotEnoughDataCard
        sessionCount={trend.sessionCount}
        spanDays={trend.spanDays}
        label={td("READING")}
        testId="trend-not-enough-data-reading"
        minSessions={minSessions}
        minSpanDays={minSpanDays}
      />
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3" data-testid="trend-reading-section">
      <div className="mb-2 px-1 text-[11px] font-bold tracking-wide text-text-3">
        {t("readingHeader")}
      </div>
      <div className="flex flex-col gap-3">
        {/* min=0/max=0: real measured WPM has a natural floor (never
            negative) but no fixed ceiling the way an internal difficulty
            range does — TrendChart's own Math.max(max, ...data) then
            derives the real ceiling purely from the data. */}
        <TrendChart
          title={t("pace")}
          points={trend.wpmPoints}
          color="var(--color-reading)"
          min={0}
          max={0}
          formatValue={(v) => t("wpmValue", { value: v })}
          testId="trend-reading-wpm"
        />
        <TrendChart
          title={t("comprehension")}
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
  const t = useTranslations("trends");
  const hasAnyData = taskTrends.length > 0 || reading !== null;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-1 font-display text-[22px] font-bold text-text">{t("title")}</h1>
      <div className="mb-5 text-[12.5px] text-text-2">
        {t("subtitle")}
      </div>

      {!hasAnyData ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <div className="mb-3 text-sm text-text-2">
            {t("empty")}
          </div>
          <Link
            href="/progress"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            {t("back")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {taskTrends.map((trend) => (
            <TaskTrendSection key={trend.method} trend={trend} minSessions={minSessions} minSpanDays={minSpanDays} />
          ))}
          {reading && <ReadingTrendSection trend={reading} minSessions={minSessions} minSpanDays={minSpanDays} />}
          <Link href="/progress" className="mt-2 text-center text-[12.5px] font-bold text-accent">
            {t("back")}
          </Link>
        </div>
      )}
    </div>
  );
}

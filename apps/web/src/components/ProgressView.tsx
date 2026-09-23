"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ProgressData, TrainedTaskProgress } from "@/lib/progress-data";
import type { NearTransferAssessmentSummary } from "@/lib/near-transfer-assessment";

// Built against prototype/Progress.dc.html. Two honest departures from
// the mockup's specific example content:
//
// - "Similar tasks" (near transfer) shows each real AssessmentResult
//   the user has actually taken (docs/kanban.md's "Wire Similar
//   Cognitive Tasks to real near-transfer data" card) instead of the
//   mockup's fabricated result narrative — a user who hasn't taken
//   either near-transfer assessment yet still sees the honest "not
//   measured yet" placeholder, same real-data-or-honest-placeholder
//   pattern the Trained tab already established.
// - "Broader transfer" is copied close to verbatim from the mockup —
//   it's already an honest static disclaimer, not a data display, so
//   there was nothing to make more real.

type Tab = "trained" | "similar" | "broader";

export function ProgressView({ data }: { data: ProgressData }) {
  const t = useTranslations("progress");
  const [tab, setTab] = useState<Tab>("trained");

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-5 font-display text-[22px] font-bold text-text">{t("title")}</h1>

      {!data.hasAnyData ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <div className="mb-3 text-sm text-text-2">
            {t("empty")}
          </div>
          <Link
            href="/"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            {t("backHome")}
          </Link>
        </div>
      ) : (
        <>
          {data.reading && (data.reading.hasComparison || data.reading.bestWpm != null) && (
            <div className="mb-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
              {data.reading.hasComparison && (
                <>
                  <div className="mb-3.5 text-[12px] font-bold tracking-wide text-text-3">
                    {data.reading.isAllTimeTrend ? t("readingAllTime") : t("readingLast30")}
                  </div>
                  <div className="flex gap-7">
                    <div>
                      <div className="mb-0.5 text-[11px] text-text-3">{t("pace")}</div>
                      <div className="font-num text-2xl font-bold text-text">
                        {data.reading.startWpm} → {data.reading.endWpm}{" "}
                        <span className="font-body text-xs font-normal text-text-2">{t("wpm")}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-0.5 text-[11px] text-text-3">{t("comprehension")}</div>
                      <div className="font-num text-2xl font-bold text-success">
                        {data.reading.startComprehensionPct}% → {data.reading.endComprehensionPct}%
                      </div>
                    </div>
                  </div>
                </>
              )}
              {data.reading.bestWpm != null && data.reading.bestComprehensionPct != null && (
                <div className={data.reading.hasComparison ? "mt-4 border-t border-border pt-3.5" : ""} data-testid="reading-personal-best">
                  <div className="mb-0.5 text-[11px] text-text-3">{t("personalBest")}</div>
                  <div className="font-num text-base font-bold text-text">
                    {data.reading.bestWpm} {t("wpm")}{" "}
                    <span className="font-body text-xs font-normal text-text-2">
                      {t("atComprehension", { pct: data.reading.bestComprehensionPct })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Link
            href="/progress/trends"
            className="mb-4 block rounded-lg border border-border bg-surface p-4 text-[12.5px] font-bold shadow-sm"
            data-testid="trends-cta"
          >
            {data.isPremium ? t("trendsCta") : t("trendsCtaLocked")}
          </Link>

          <div className="mb-4 flex gap-1 rounded-full bg-surface-2 p-1">
            {(["trained", "similar", "broader"] as const).map((key) => (
              <button
                key={key}
                data-testid={`progress-tab-${key}`}
                onClick={() => setTab(key)}
                className="flex-1 rounded-full py-2.5 text-center text-[12.5px] font-bold transition-transform duration-micro active:scale-95"
                style={
                  tab === key
                    ? { background: "var(--color-surface)", color: "var(--color-text)" }
                    : { color: "var(--color-text-2)" }
                }
              >
                {t(`tabs.${key}`)}
              </button>
            ))}
          </div>

          {tab === "trained" &&
            (data.trainedTasks.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-5 text-sm text-text-2 shadow-sm">
                {t("noOtherTasks")}
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
              {data.nearTransferAssessments.length === 0 ? (
                <div className="mb-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
                  <div className="mb-1.5 text-[13.5px] font-bold text-text">{t("noNearTransfer")}</div>
                  <div className="text-[12.5px] leading-relaxed text-text-2">
                    {t("noNearTransferBody")}
                  </div>
                  <NearTransferCtaLinks taken={[]} isPremium={data.isPremium} />
                </div>
              ) : (
                <div className="mb-3 flex flex-col gap-3">
                  {data.nearTransferAssessments.map((assessment) => (
                    <NearTransferCard key={assessment.assessmentName} assessment={assessment} />
                  ))}
                  <NearTransferCtaLinks
                    taken={data.nearTransferAssessments.map((a) => a.assessmentName)}
                    isPremium={data.isPremium}
                  />
                </div>
              )}
              {!data.isPremium && (
                <div className="mb-3 px-1 text-xs leading-relaxed text-text-3" data-testid="near-transfer-premium-note">
                  {t("nearTransferPremium")}
                </div>
              )}
              <div className="px-1 text-xs leading-relaxed text-text-3">
                {t("measuredPeriodically")}
              </div>
            </>
          )}

          {tab === "broader" && (
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="mb-2 text-[13.5px] font-bold text-text">{t("notYetMeasured")}</div>
              <div className="text-[12.5px] leading-relaxed text-text-2">
                {t("broaderBody")}
              </div>
              <Link href="/train/n-back" className="mt-3.5 block text-[12.5px] font-bold text-accent">
                {t("seeResearch")}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Kept local rather than importing apps/web/src/lib/near-transfer-assessment.ts's
// NEAR_TRANSFER_ASSESSMENTS here — that module also imports the Prisma
// client (server-only) and this is a "use client" component, so pulling
// it in would bundle server code into the client. Just display labels;
// the real per-domain science lives in docs/evidence-review.md §11/§12.
const ALL_NEAR_TRANSFER_ASSESSMENTS = [
  { name: "Backward Digit Span", key: "backwardDigitSpan", route: "/assessments/backward-digit-span", color: "var(--color-wm)" },
  { name: "Backward Spatial Span", key: "backwardSpatialSpan", route: "/assessments/backward-spatial-span", color: "var(--color-spatial)" },
] as const;

// Assessment.name (English, the DB identity) -> its messages key.
const ASSESSMENT_KEY_BY_NAME: Record<string, "backwardDigitSpan" | "backwardSpatialSpan"> = {
  "Backward Digit Span": "backwardDigitSpan",
  "Backward Spatial Span": "backwardSpatialSpan",
};

function NearTransferCtaLinks({ taken, isPremium }: { taken: string[]; isPremium: boolean }) {
  const t = useTranslations("progress");
  const ta = useTranslations("assessmentNames");
  return (
    <div className="mt-3.5 flex flex-wrap gap-2">
      {ALL_NEAR_TRANSFER_ASSESSMENTS.map((a) => (
        <Link
          key={a.name}
          href={a.route}
          className="inline-block rounded-full px-4.5 py-2.5 text-[12.5px] font-bold text-on-accent"
          style={{ background: a.color }}
        >
          {isPremium
            ? taken.includes(a.name)
              ? t("retakeAssessment", { name: ta(a.key) })
              : t("takeAssessment", { name: ta(a.key) })
            : t("assessmentLocked", { name: ta(a.key) })}
        </Link>
      ))}
    </div>
  );
}

function NearTransferCard({ assessment }: { assessment: NearTransferAssessmentSummary }) {
  const t = useTranslations("progress");
  const ta = useTranslations("assessmentNames");
  const format = useFormatter();
  const takenAt = new Date(assessment.takenAt);
  const key = ASSESSMENT_KEY_BY_NAME[assessment.assessmentName];
  return (
    <div
      className="rounded-lg border border-border bg-surface p-5 shadow-sm"
      data-testid={`near-transfer-card-${assessment.route.split("/").pop()}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13.5px] font-bold text-text">{key ? ta(key) : assessment.assessmentName}</div>
        <span className="text-[11px] text-text-3">{format.dateTime(takenAt, { dateStyle: "short" })}</span>
      </div>
      <div className="mb-3 text-xs text-text-2">
        {key ? t(`nearTransferRelated.${key}`) : assessment.trainedTaskLabel}
      </div>
      <div className="flex gap-7">
        <div>
          <div className="mb-0.5 text-[11px] text-text-3">{t("backwardSpan")}</div>
          <div className="font-num text-xl font-bold text-text">{assessment.finalSpan}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[11px] text-text-3">{t("atThatLength")}</div>
          <div className="font-num text-xl font-bold text-text">
            {assessment.finalSpanCorrect}/{assessment.finalSpanTrials}
          </div>
        </div>
      </div>
      <div className="mt-2.5 text-[11px] leading-relaxed text-text-3">
        {t("confidenceInterval", {
          level: assessment.confidenceLevelPct,
          lower: assessment.confidenceIntervalLowerPct,
          upper: assessment.confidenceIntervalUpperPct,
        })}
      </div>
    </div>
  );
}

function TrainedTaskCard({ task }: { task: TrainedTaskProgress }) {
  const t = useTranslations("progress");
  const tm = useTranslations("methods");
  const te = useTranslations("evidence");
  const isSpan = task.method === "complex-span-v0";
  const p = task.progress;
  const progressLine =
    p.kind === "trend"
      ? isSpan
        ? t("spanTrend", { start: p.start, end: p.end })
        : t("levelTrend", { start: p.start, end: p.end, sessions: p.sessions })
      : p.kind === "noRecentSessions"
        ? t("noRecentSessions")
        : t("calibratedAt", { level: p.level });
  const bestLine =
    task.personalBestValue == null
      ? task.personalBestLabel
      : isSpan
        ? t("bestSpan", { value: task.personalBestValue })
        : t("bestLevel", { value: task.personalBestValue });
  const evidenceKey = task.evidenceBadge.toLowerCase();
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13.5px] font-bold text-text">
          {tm.has(task.method as never) ? tm(task.method as never) : task.displayName}
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}
        >
          {te.has(evidenceKey as never) ? te(evidenceKey as never) : task.evidenceBadge}
        </span>
      </div>
      <div className="mb-2.5 text-xs text-text-2">{progressLine}</div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(task.progressFraction * 100)}%` }} />
      </div>
      {task.personalBestLabel ? (
        <div className="mt-2.5 text-[11px] font-semibold text-text-3" data-testid={`personal-best-${task.method}`}>
          {t("personalBestLine", { value: bestLine ?? "" })}
        </div>
      ) : null}
      {task.historyLimitedToLast30Days ? (
        <div className="mt-2 text-[11px] text-text-3" data-testid={`history-limited-${task.method}`}>
          {t("historyLimited")}
        </div>
      ) : null}
    </div>
  );
}

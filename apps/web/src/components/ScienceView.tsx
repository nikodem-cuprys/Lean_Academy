import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ScienceData } from "@/lib/science-data";

// Built against prototype/Science.dc.html. No client-side state needed
// (no tabs, no interactivity), so this is a plain server component,
// unlike ProgressView. One deliberate v0 scope cut from the mockup:
// its "Tap one to see what it trains..." implies a per-module detail
// drill-down screen, which doesn't exist yet — the intro copy here
// doesn't promise that, and rows aren't rendered as tappable, rather
// than shipping dead taps. The excluded-methods footer note is fully
// data-driven (real displayNames from data/evidence-registry.json),
// not the mockup's specific hand-typed example.

// Module names and target constructs come straight from
// data/evidence-registry.json — reviewed scientific content that stays in
// English rather than being machine-translated (see the i18n entry in
// docs/kanban.md), with a note saying so for non-English readers (and
// lang="en" on those nodes, so screen readers pronounce them correctly).
// The page chrome and evidence-level badges are translated.
export function ScienceView({ data }: { data: ScienceData }) {
  const t = useTranslations("science");
  const te = useTranslations("evidence");
  const tc = useTranslations("common");
  const locale = useLocale();
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-1.5 font-display text-[23px] font-bold text-text">{t("title")}</h1>
      <div className="mb-4.5 text-[13px] leading-relaxed text-text-2">
        {t("intro")}
      </div>
      {locale !== "en" && (
        <div className="mb-4.5 rounded-md bg-surface-2 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2" lang={locale}>
          {t("englishNote")}
        </div>
      )}

      <div className="mb-4.5 flex gap-6 rounded-lg border border-border bg-surface p-4">
        <StatCell value={data.reviewedCount} label={t("statReviewed")} testId="stat-reviewed" />
        <StatCell value={data.implementedCount} label={t("statImplemented")} testId="stat-implemented" />
        <StatCell value={data.excludedCount} label={t("statExcluded")} testId="stat-excluded" />
      </div>

      <div className="rounded-lg border border-border bg-surface px-4.5 py-1 shadow-sm">
        {data.approvedModules.map((module, i) => (
          <div
            key={module.method}
            data-testid={`science-module-${module.method}`}
            className="flex items-center gap-3 py-3.5"
            style={{
              borderBottom: i < data.approvedModules.length - 1 ? "1px solid var(--color-border)" : "none",
              background: module.implemented ? "var(--color-accent-soft)" : undefined,
              margin: module.implemented ? "0 -18px" : undefined,
              padding: module.implemented ? "14px 18px" : undefined,
              borderRadius: module.implemented ? "14px" : undefined,
            }}
          >
            <div className="h-[32px] w-[32px] flex-shrink-0 rounded-md bg-accent-soft" />
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-text" lang="en">{module.displayName}</div>
              <div className="text-[11.5px] text-text-3" lang="en">{module.targetConstruct}</div>
            </div>
            <span
              className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={
                module.implemented
                  ? { background: "var(--color-surface)", color: "var(--color-accent-strong)", border: "1px solid var(--color-accent)" }
                  : { background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
              }
            >
              {te.has(module.evidenceLevel as never) ? te(module.evidenceLevel as never) : module.evidenceBadge}
            </span>
          </div>
        ))}
      </div>

      {data.excludedCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 px-0.5 text-xs leading-relaxed text-text-3">
          <span>
            {t("excludedNote", { count: data.excludedCount, names: data.excludedDisplayNames.join(" / ") })}
          </span>
        </div>
      )}

      <Link href="/" className="mt-6 text-center text-sm font-semibold text-accent underline">
        {tc("backHome")}
      </Link>
    </div>
  );
}

function StatCell({ value, label, testId }: { value: number; label: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="font-num text-xl font-bold text-text">{value}</div>
      <div className="text-[11px] text-text-3">{label}</div>
    </div>
  );
}

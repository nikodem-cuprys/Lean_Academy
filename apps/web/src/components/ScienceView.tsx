import Link from "next/link";
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

export function ScienceView({ data }: { data: ScienceData }) {
  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-1.5 font-display text-[23px] font-bold text-text">The Science</h1>
      <div className="mb-4.5 text-[13px] leading-relaxed text-text-2">
        Every exercise here is backed by cited research — see what&rsquo;s proven, what&rsquo;s still limited, and
        what we chose not to include.
      </div>

      <div className="mb-4.5 flex gap-6 rounded-lg border border-border bg-surface p-4">
        <StatCell value={data.reviewedCount} label="reviewed" testId="stat-reviewed" />
        <StatCell value={data.implementedCount} label="in your training" testId="stat-implemented" />
        <StatCell value={data.excludedCount} label="excluded" testId="stat-excluded" />
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
              <div className="text-[13.5px] font-bold text-text">{module.displayName}</div>
              <div className="text-[11.5px] text-text-3">{module.targetConstruct}</div>
            </div>
            <span
              className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={
                module.implemented
                  ? { background: "var(--color-surface)", color: "var(--color-accent-strong)", border: "1px solid var(--color-accent)" }
                  : { background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
              }
            >
              {module.evidenceBadge}
            </span>
          </div>
        ))}
      </div>

      {data.excludedCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 px-0.5 text-xs leading-relaxed text-text-3">
          <span>
            {data.excludedCount} method{data.excludedCount === 1 ? "" : "s"} we reviewed and did not include —{" "}
            {data.excludedDisplayNames.join(" and ")} — didn&rsquo;t meet our evidence bar.
          </span>
        </div>
      )}

      <Link href="/" className="mt-6 text-center text-sm font-semibold text-accent underline">
        ← Back home
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

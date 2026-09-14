import type { AchievementStatus } from "@/lib/achievements-data";

// Built against prototype/Achievements.dc.html. No client-side state
// needed (no tabs, no interactivity), so this is a plain server
// component, matching ScienceView's pattern. Icons are a plain emoji
// keyed by each achievement's real iconKey (packages/db/src/
// achievement-catalog.ts) rather than a new icon-asset system this
// project doesn't otherwise have.

const ICON_EMOJI: Record<string, string> = {
  star: "⭐",
  flame: "🔥",
  dots: "🧠",
  book: "📖",
  list: "📋",
  target: "🎯",
  check: "✅",
};

function formatEarnedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AchievementsView({ achievements }: { achievements: AchievementStatus[] }) {
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="font-display text-[23px] font-bold text-text">Achievements</h1>
      <div className="mb-3 text-[13px] text-text-2">
        {earnedCount} of {achievements.length} earned
      </div>

      <div className="rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {achievements.map((a, i) => (
          <div
            key={a.key}
            data-testid={`achievement-${a.key}`}
            className="flex items-center gap-3.5 py-3.5"
            style={{ borderBottom: i < achievements.length - 1 ? "1px solid var(--color-border)" : "none" }}
          >
            <div
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] text-[17px]"
              style={
                a.earned
                  ? { background: "var(--color-accent-soft)" }
                  : { background: "var(--color-surface-2)", border: "1.5px dashed var(--color-border)" }
              }
              aria-hidden="true"
            >
              {ICON_EMOJI[a.iconKey] ?? "⭐"}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-text">{a.title}</div>
              {a.earned ? (
                <div className="text-xs text-text-3">
                  Earned {a.earnedAt ? formatEarnedDate(a.earnedAt) : ""}
                  {a.contextLabel ? ` — ${a.contextLabel}` : ""}
                </div>
              ) : a.progressCurrent !== null && a.progressTarget !== null ? (
                <>
                  <div className="text-xs text-text-3">
                    {a.progressCurrent} of {a.progressTarget}
                  </div>
                  <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-text-3"
                      style={{ width: `${Math.round(Math.min(1, a.progressCurrent / a.progressTarget) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-xs text-text-3">Not yet earned</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

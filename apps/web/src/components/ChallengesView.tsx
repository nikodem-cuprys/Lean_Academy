import type { WeeklyChallengeStatus } from "@/lib/weekly-challenges";

// No prototype/*.dc.html artboard exists for Weekly Challenges (checked
// — see docs/kanban.md's Done entry for this card) — built to match the
// visual pattern AchievementsView.tsx already established (same card
// shell, same earned/progress-bar row layout) rather than inventing a
// new one, since the two screens are conceptually siblings (real
// progress toward a real, checkable milestone).

function formatEndsAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChallengesView({ challenges }: { challenges: WeeklyChallengeStatus[] }) {
  const completedCount = challenges.filter((c) => c.completed).length;
  const endsAt = challenges[0]?.endsAt;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="font-display text-[23px] font-bold text-text">Weekly Challenges</h1>
      <div className="mb-3 text-[13px] text-text-2">
        {completedCount} of {challenges.length} complete{endsAt ? ` — resets ${formatEndsAt(endsAt)}` : ""}
      </div>

      <div className="rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {challenges.map((c, i) => (
          <div
            key={c.slug}
            data-testid={`challenge-${c.slug}`}
            className="flex items-center gap-3.5 py-3.5"
            style={{ borderBottom: i < challenges.length - 1 ? "1px solid var(--color-border)" : "none" }}
          >
            <div
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] text-[17px]"
              style={
                c.completed
                  ? { background: "var(--color-accent-soft)" }
                  : { background: "var(--color-surface-2)", border: "1.5px dashed var(--color-border)" }
              }
              aria-hidden="true"
            >
              {c.completed ? "✅" : "🎯"}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-text">{c.title}</div>
              <div className="text-xs text-text-3">{c.description}</div>
              {c.completed ? (
                <div className="mt-1 text-xs text-text-3">Complete</div>
              ) : (
                <>
                  <div className="mt-1 text-xs text-text-3">
                    {c.progressCurrent} of {c.progressTarget}
                  </div>
                  <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-text-3"
                      style={{ width: `${Math.round(Math.min(1, c.progressCurrent / c.progressTarget) * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

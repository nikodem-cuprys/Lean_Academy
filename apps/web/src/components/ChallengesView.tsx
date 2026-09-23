import { useFormatter, useTranslations } from "next-intl";
import type { WeeklyChallengeStatus } from "@/lib/weekly-challenges";
import type { DailyQuestStatus } from "@/lib/daily-quests";

// No prototype/*.dc.html artboard exists for Weekly Challenges or Daily
// Quests (checked — see docs/kanban.md's Done entry for the Weekly
// Challenges card) — built to match the visual pattern
// AchievementsView.tsx already established (same card shell, same
// earned/progress-bar row layout) rather than inventing a new one,
// since all three screens are conceptually siblings (real progress
// toward a real, checkable milestone). Daily Quests render first, above
// Weekly Challenges, matching Duolingo's own convention of surfacing
// the shorter-cadence goal first.

type QuestLikeStatus = WeeklyChallengeStatus | DailyQuestStatus;

function QuestSection({
  title,
  icon,
  items,
  resetLabel,
}: {
  title: string;
  icon: string;
  items: QuestLikeStatus[];
  resetLabel: string | null;
}) {
  const t = useTranslations("challenges");
  const completedCount = items.filter((c) => c.completed).length;
  const itemText = (c: QuestLikeStatus, field: "title" | "description") => {
    const key = `items.${c.slug}.${field}` as never;
    return t.has(key) ? t(key, c.messageParams as never) : c[field];
  };

  return (
    <div className="mb-6">
      <h2 className="font-display text-[17px] font-bold text-text">{title}</h2>
      <div className="mb-3 text-[13px] text-text-2">
        {t("completeCount", { done: completedCount, total: items.length })}
        {resetLabel ? t("resets", { when: resetLabel }) : ""}
      </div>

      <div className="rounded-lg border border-border bg-surface px-4.5 shadow-sm">
        {items.map((c, i) => (
          <div
            key={c.slug}
            data-testid={`challenge-${c.slug}`}
            className="flex items-center gap-3.5 py-3.5"
            style={{ borderBottom: i < items.length - 1 ? "1px solid var(--color-border)" : "none" }}
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
              {c.completed ? "✅" : icon}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-text">{itemText(c, "title")}</div>
              <div className="text-xs text-text-3">{itemText(c, "description")}</div>
              {c.completed ? (
                <div className="mt-1 text-xs text-text-3">{t("complete")}</div>
              ) : (
                <>
                  <div className="mt-1 text-xs text-text-3">
                    {t("progress", { current: c.progressCurrent, target: c.progressTarget })}
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

export function ChallengesView({
  dailyQuests,
  weeklyChallenges,
}: {
  dailyQuests: DailyQuestStatus[];
  weeklyChallenges: WeeklyChallengeStatus[];
}) {
  const t = useTranslations("challenges");
  const format = useFormatter();
  const dailyEndsAt = dailyQuests[0]?.endsAt;
  const weeklyEndsAt = weeklyChallenges[0]?.endsAt;

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6">
      <h1 className="mb-4 font-display text-[23px] font-bold text-text">{t("title")}</h1>

      <QuestSection
        title={t("daily")}
        icon="🎯"
        items={dailyQuests}
        resetLabel={dailyEndsAt ? format.dateTime(new Date(dailyEndsAt), { hour: "numeric", minute: "2-digit" }) : null}
      />
      <QuestSection
        title={t("weekly")}
        icon="🏆"
        items={weeklyChallenges}
        resetLabel={weeklyEndsAt ? format.dateTime(new Date(weeklyEndsAt), { month: "short", day: "numeric" }) : null}
      />
    </div>
  );
}

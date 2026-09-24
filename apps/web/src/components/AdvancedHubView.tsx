"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ADVANCED_METHODS, ADVANCED_SLUGS, type AdvancedMethod } from "@/lib/advanced-settings";
import { AdvancedRunList, METHOD_COLOR, useExerciseName, type AdvancedRunView } from "@/components/AdvancedRunList";

// The Advanced tab's landing screen (/advanced). No prototype artboard
// exists for it, so it follows the same card-shell pattern as
// ExerciseSettingsView/ChallengesView. Kept visually apart from Home's
// "Today's Training" on purpose: these lessons are a separate track
// (see apps/web/src/lib/advanced-settings.ts).

export function AdvancedHubView({
  customized,
  recentRuns,
}: {
  customized: Record<AdvancedMethod, boolean>;
  recentRuns: AdvancedRunView[];
}) {
  const t = useTranslations("advanced");
  const exerciseName = useExerciseName();

  return (
    <div className="flex w-full max-w-[390px] flex-1 flex-col px-6 py-6 md:max-w-[560px]" data-testid="advanced-hub">
      <Link href="/" className="mb-3 text-[13px] font-semibold text-accent">
        {t("backHome")}
      </Link>
      <h1 className="font-display text-[23px] font-bold text-text">{t("title")}</h1>
      <p className="mb-3 text-[13px] text-text-2">{t("intro")}</p>
      <div className="mb-5 rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed" style={{ borderColor: "var(--color-caution)", background: "var(--color-caution-soft)", color: "var(--color-text)" }}>
        {t("separateNote")}
      </div>

      <h2 className="mb-2.5 text-[12px] font-bold tracking-wide text-text-3">{t("lessons")}</h2>
      <ul className="mb-6 flex flex-col gap-2.5">
        {ADVANCED_METHODS.map((method) => (
          <li key={method}>
            <Link
              href={`/advanced/${ADVANCED_SLUGS[method]}`}
              data-testid={`advanced-lesson-${method}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 shadow-sm transition-colors hover:border-accent"
            >
              <div
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: `var(--color-${METHOD_COLOR[method]})` }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-text">{exerciseName(method)}</div>
                <div className="text-[12px] text-text-3">{t(`tunes.${ADVANCED_SLUGS[method]}` as never)}</div>
              </div>
              <span
                className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={
                  customized[method]
                    ? { background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
                    : { background: "var(--color-surface-2)", color: "var(--color-text-3)" }
                }
              >
                {customized[method] ? t("custom") : t("defaults")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-2.5 text-[12px] font-bold tracking-wide text-text-3">{t("recentRuns")}</h2>
      <AdvancedRunList runs={recentRuns} showMethod />
    </div>
  );
}

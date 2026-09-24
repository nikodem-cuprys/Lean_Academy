import type { ReactNode } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { parseEvidenceRegistry, getApprovedModules } from "@lean-academy/evidence";
import { auth } from "@/lib/auth";
import { getTodaysTraining } from "@/lib/todays-training";
import { getStreakStatus, getWeeklyActivity, type WeeklyActivityDay } from "@/lib/streak";
import { getTrainingLevelStatus } from "@/lib/xp";
import { getLatestEarnedAchievement, type LatestAchievement } from "@/lib/achievements-data";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
// Imported (not read via fs) because Next's server bundle virtualizes
// __dirname, which breaks the fs-based loadEvidenceRegistry — see the
// comment on parseEvidenceRegistry in packages/evidence.
import registryJson from "../../../../data/evidence-registry.json";

const DOMAIN_COLOR_CLASS: Record<string, string> = {
  WORKING_MEMORY: "wm",
  READING: "reading",
  SPATIAL: "spatial",
};

// Small inline-SVG glyphs, styled to match prototype/Home.dc.html's
// icon treatment (currentColor strokes/fills sized ~14-16px). Kept
// here rather than as a shared icon library since nothing else in
// apps/web needs an icon set yet.
function DomainIcon({ domain }: { domain: string }) {
  if (domain === "WORKING_MEMORY") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="17" r="2" fill="currentColor" />
        <circle cx="12" cy="7" r="2" fill="currentColor" />
        <circle cx="18" cy="15" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (domain === "READING") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5.5c3-1.4 6-1.4 8 0v13c-2-1.4-5-1.4-8 0v-13z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M20 5.5c-3-1.4-6-1.4-8 0v13c2-1.4 5-1.4 8 0v-13z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      <circle cx="13" cy="7" r="1.5" fill="currentColor" />
      <circle cx="7" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface QuickLink {
  href: string;
  label: string;
  domain?: string;
  icon?: ReactNode;
}

const CHART_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const FLASK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 3h6v4l3 8a2 2 0 01-1.9 2.7H7.9A2 2 0 016 14.9L9 7V3z" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const TROPHY_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);
const TARGET_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const SETTINGS_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M19.4 13.5a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19.5a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4.5a2 2 0 110-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4.5a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1h.09a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

type TodaysExercise = { method: string; domain: string; displayName: string };

// One real card, one real DOM instance at every breakpoint — only its
// internal domain-tile direction changes (stacked full-width rows on
// phone, a horizontal row from tablet up) via responsive classes.
// Deliberately NOT two separate components/instances: this project's
// whole e2e suite locates real interactive elements by role/text/
// testid assuming exactly one match per page, so a genuinely responsive
// rebuild has to reflow one tree with CSS rather than render two
// parallel trees and hide one — the latter would silently double every
// link/button in the DOM and break strict-mode element lookups
// throughout the existing suite. No per-domain minute estimate either:
// prototype/HomeDesktop.dc.html's mockup shows one, but nothing in
// apps/web computes a real per-exercise duration anywhere (checked
// todays-training.ts) — an invented number would violate this
// project's real-data-only rule, so it's honestly omitted.
function TodaysTrainingCard({ exercises }: { exercises: TodaysExercise[] }) {
  const t = useTranslations("home");
  const td = useTranslations("domains");
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm lg:p-8">
      <div className="mb-4 text-[12px] font-bold tracking-wide text-text-3">{t("todaysTraining")}</div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:flex-wrap">
        {exercises.map((e) => (
          <div
            key={e.method}
            className="flex items-center gap-3 md:flex-1 md:min-w-[150px] md:rounded-md md:bg-surface-2 md:p-3"
          >
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
              style={{
                background: `var(--color-${DOMAIN_COLOR_CLASS[e.domain]}-soft)`,
                color: `var(--color-${DOMAIN_COLOR_CLASS[e.domain]})`,
              }}
            >
              <DomainIcon domain={e.domain} />
            </div>
            <div className="flex-1 text-sm font-semibold text-text">
              {td.has(e.domain as never) ? td(e.domain as never) : e.displayName}
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/train/session"
        className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent transition-transform active:scale-[0.98] lg:w-auto lg:px-8"
      >
        {t("startTraining")}
      </Link>
    </div>
  );
}

// Real per-day activity for the current UTC week (see
// apps/web/src/lib/streak.ts's getWeeklyActivity) — shown from tablet
// width up, where there's room for it; the phone layout stays exactly
// as scoped before (see the Session orchestration card in
// docs/kanban.md for why it was left out originally — it's real now,
// not faked, but still not squeezed onto the smallest layout).
function WeeklyActivityStrip({ days }: { days: WeeklyActivityDay[] }) {
  const t = useTranslations("home");
  const weekdayLetters = t("weekdayLetters").split(",");
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm" data-testid="weekly-activity-strip">
      <div className="mb-3.5 text-[12px] font-bold tracking-wide text-text-3">{t("thisWeek")}</div>
      <div className="flex gap-1.5">
        {days.map((d) => (
          <div key={d.dayOfWeek} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="h-[26px] w-full rounded-md"
              style={
                d.trained
                  ? { background: "var(--color-accent)" }
                  : { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }
              }
              title={d.trained ? t("dayTrained") : d.isToday ? t("dayTodayNotYet") : t("dayNoSession")}
            />
            <span className="text-[10.5px] font-semibold text-text-3">{weekdayLetters[d.dayOfWeek]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LatestAchievementCard({ achievement }: { achievement: LatestAchievement | null }) {
  const t = useTranslations("home");
  const ta = useTranslations("achievements.catalog");
  const format = useFormatter();
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="mb-3.5 text-[12px] font-bold tracking-wide text-text-3">{t("recentAchievement")}</div>
      {achievement ? (
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}
          >
            {TROPHY_ICON}
          </div>
          <div>
            <div className="text-[13px] font-bold text-text">
              {ta.has(`${achievement.key}.title` as never) ? ta(`${achievement.key}.title` as never) : achievement.title}
            </div>
            <div className="text-[11.5px] text-text-3">
              {t("earnedOn", { date: format.dateTime(new Date(achievement.earnedAt), { month: "short", day: "numeric" }) })}
            </div>
          </div>
        </div>
      ) : (
        <Link href="/achievements" className="text-[13px] font-semibold text-accent">
          {t("noAchievements")}
        </Link>
      )}
    </div>
  );
}

const SLIDERS_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function QuickLinksGrid({ links }: { links: QuickLink[] }) {
  const t = useTranslations("home");
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold tracking-wide text-text-3">{t("quickLinks")}</div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        {links.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-3 text-[12.5px] font-semibold leading-snug text-text shadow-sm transition-colors hover:border-accent"
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
              style={
                q.domain
                  ? {
                      background: `var(--color-${DOMAIN_COLOR_CLASS[q.domain]}-soft)`,
                      color: `var(--color-${DOMAIN_COLOR_CLASS[q.domain]})`,
                    }
                  : { background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }
              }
            >
              {q.domain ? <DomainIcon domain={q.domain} /> : q.icon}
            </div>
            <span>{q.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EvidenceStatsFooter({
  lastReviewed,
  approvedCount,
  signedInAs,
}: {
  lastReviewed: string;
  approvedCount: number;
  signedInAs: string | null;
}) {
  const t = useTranslations("home");
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-4 text-[12px] text-text-3">
      <dt>{t("registryReviewed")}</dt>
      <dd className="text-right text-text-2">{lastReviewed}</dd>
      <dt>{t("approvedModules")}</dt>
      <dd className="text-right text-text-2">{approvedCount}</dd>
      <dt>{t("signedIn")}</dt>
      <dd className="text-right text-text-2">{signedInAs ?? t("signedInNo")}</dd>
    </dl>
  );
}

function StreakLevelPills({
  streak,
  trainingLevel,
}: {
  streak: { currentStreakDays: number; trainedToday: boolean } | null;
  trainingLevel: { level: number } | null;
}) {
  const t = useTranslations("home");
  if (!((streak && streak.currentStreakDays > 0) || trainingLevel)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {streak && streak.currentStreakDays > 0 ? (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold"
          style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}
          data-testid="streak-indicator"
        >
          <span aria-hidden="true">🔥</span>
          <span>
            {t("streak", { days: streak.currentStreakDays })}
            {!streak.trainedToday ? t("streakNudge") : ""}
          </span>
        </div>
      ) : null}
      {trainingLevel ? (
        <div
          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}
        >
          <span data-testid="training-level-indicator">{t("trainingLevel", { level: trainingLevel.level })}</span>
        </div>
      ) : null}
    </div>
  );
}

// Built against prototype/Home.dc.html (phone) and prototype/
// HomeDesktop.dc.html (desktop, Tailwind's `lg:` breakpoint, >=1024px).
// Device layout is detected the standard, SSR-safe web way — CSS media
// queries via Tailwind responsive classes — not a client-side
// navigator/user-agent check, and not two parallel DOM trees either:
// there is exactly one real instance of every interactive element
// (links, the streak/level pills, Quick Links) at all times, and only
// its layout (column count, flex-direction, spacing, and whether the
// sidebar/weekly-activity/achievement pieces render at all) changes via
// responsive classes. This matters beyond style: this project's e2e
// suite finds real elements by role/text/testid assuming one match per
// page, so duplicating whole subtrees to fake "3 layouts" would have
// silently broken that everywhere a link or button appears on Home.
//
// Tablet (`md:`, >=768px) has no dedicated prototype artboard (checked)
// — it's the phone tree widened, gaining the real weekly-activity strip
// and recent-achievement card (both genuinely computed, see below) plus
// extra Quick Links columns and horizontal domain tiles, rather than a
// third undesigned layout invented from scratch. Desktop (`lg:`) adds
// the real sidebar nav (DashboardSidebar.tsx, linking to every real
// screen that exists — the mockup's "Profile" item doesn't correspond
// to a real route, so it's replaced rather than linked to nothing) and
// a 2-column content grid matching the mockup.
//
// "This week" and "Recent achievement" are real, not fabricated: the
// former is genuinely computed from this week's TrainingSession rows
// (streak.ts's getWeeklyActivity), the latter reads the real
// most-recently-earned UserAchievement row. One deliberate, documented
// cut from the mockup: its "Reading assessment in 3 days" reminder
// isn't included — near-transfer assessments are premium-gated (see the
// Entitlement System card in docs/kanban.md) and surfacing that state
// honestly on a free dashboard needs its own design pass, not a quick
// add here.
export default async function HomePage() {
  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");
  const approved = getApprovedModules(registry);
  const session = await auth();
  const userId = session?.user?.id;
  const [exercises, streak, trainingLevel, weeklyActivity, latestAchievement] = userId
    ? await Promise.all([
        getTodaysTraining(userId),
        getStreakStatus(userId),
        getTrainingLevelStatus(userId),
        getWeeklyActivity(userId),
        getLatestEarnedAchievement(userId),
      ])
    : [null, null, null, null, null];
  const firstName = session?.user?.name?.split(" ")[0];
  const t = await getTranslations("home");

  const quickLinks: QuickLink[] = [
    { href: "/progress", label: t("links.progress"), icon: CHART_ICON },
    { href: "/science", label: t("links.science"), icon: FLASK_ICON },
    { href: "/achievements", label: t("links.achievements"), icon: TROPHY_ICON },
    { href: "/challenges", label: t("links.challenges"), icon: TARGET_ICON },
    { href: "/settings/exercises", label: t("links.customize"), icon: SETTINGS_ICON },
    { href: "/advanced", label: t("links.advanced"), icon: SLIDERS_ICON },
    { href: "/train/n-back", label: t("links.nBack"), domain: "WORKING_MEMORY" },
    { href: "/train/complex-span", label: t("links.complexSpan"), domain: "WORKING_MEMORY" },
    { href: "/train/dice-sum", label: t("links.diceSum"), domain: "WORKING_MEMORY" },
    { href: "/train/spatial-sequence", label: t("links.spatial"), domain: "SPATIAL" },
    { href: "/train/reading", label: t("links.reading"), domain: "READING" },
  ];

  if (!session?.user) {
    return (
      <main className="flex flex-1 flex-col items-center p-6">
        <div className="flex w-full max-w-[390px] flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-[21px] font-bold text-text">LeanAcademy</h1>
            <LanguageSwitcher />
          </div>
          <Link
            href="/login"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            {t("loginOrSignup")}
          </Link>
          <EvidenceStatsFooter lastReviewed={registry.lastReviewed} approvedCount={approved.length} signedInAs={null} />
        </div>
      </main>
    );
  }

  const greeting = firstName ? t("greetingNamed", { name: firstName }) : t("greeting");
  const hasWeeklyExtras = Boolean(weeklyActivity && weeklyActivity.length > 0);

  return (
    <main className="flex flex-1" data-testid="home-dashboard">
      <div className="hidden lg:flex">
        <DashboardSidebar active="/" />
      </div>

      <div className="flex w-full flex-1 justify-center p-6 lg:justify-start lg:overflow-y-auto lg:px-12 lg:py-10">
        <div className="flex w-full max-w-[390px] flex-col gap-5 md:max-w-[640px] lg:max-w-none lg:gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="font-display text-[21px] font-bold text-text lg:text-[28px]">{greeting}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StreakLevelPills streak={streak} trainingLevel={trainingLevel} />
              {/* The sidebar carries the switcher from desktop width up. */}
              <LanguageSwitcher className="lg:hidden" />
            </div>
          </div>

          {exercises && exercises.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
              <TodaysTrainingCard exercises={exercises} />
              {hasWeeklyExtras ? (
                <div className="hidden gap-5 md:flex md:flex-col lg:gap-6">
                  <WeeklyActivityStrip days={weeklyActivity!} />
                  <LatestAchievementCard achievement={latestAchievement} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm lg:p-8">
              <div className="mb-3 text-sm text-text-2">
                {t("onboardingPrompt")}
              </div>
              <Link
                href="/onboarding"
                className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent transition-transform active:scale-[0.98] lg:inline-block lg:w-auto lg:px-8"
              >
                {t("startOnboarding")}
              </Link>
            </div>
          )}

          <QuickLinksGrid links={quickLinks} />

          <EvidenceStatsFooter lastReviewed={registry.lastReviewed} approvedCount={approved.length} signedInAs={session.user.email ?? null} />
        </div>
      </div>
    </main>
  );
}

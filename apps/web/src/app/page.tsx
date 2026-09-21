import type { ReactNode } from "react";
import Link from "next/link";
import { parseEvidenceRegistry, getApprovedModules } from "@lean-academy/evidence";
import { auth } from "@/lib/auth";
import { getTodaysTraining } from "@/lib/todays-training";
import { getStreakStatus } from "@/lib/streak";
import { getTrainingLevelStatus } from "@/lib/xp";
// Imported (not read via fs) because Next's server bundle virtualizes
// __dirname, which breaks the fs-based loadEvidenceRegistry — see the
// comment on parseEvidenceRegistry in packages/evidence.
import registryJson from "../../../../data/evidence-registry.json";

const DOMAIN_LABELS: Record<string, string> = {
  WORKING_MEMORY: "Working Memory",
  READING: "Reading",
  SPATIAL: "Spatial Memory",
};

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

// Built against prototype/Home.dc.html's "Today's Training" card, but
// deliberately scoped down: the weekly activity bar, upcoming-
// assessment/achievement cards, and the Progress/Science/Profile bottom
// nav are all real future cards of their own (Gamification and Progress
// epics in docs/kanban.md) that this one doesn't need to fake. What's
// here is genuinely real: "Today's Training" reads the user's actual
// DifficultyState rows via getTodaysTraining (see docs/kanban.md's
// Session orchestration card), "Start Training" leads into
// /train/session, which strings those exercises together without
// returning here in between, the streak indicator reads the real
// Streak row written by that same session's completion (see
// apps/web/src/lib/streak.ts, the Streaks card), and the Training
// Level indicator reads the real XpEntry-derived total (see
// apps/web/src/lib/xp.ts, the XP + Training Level card) — matching
// prototype/Home.dc.html's "8-day streak | Training Level 12" layout.
export default async function HomePage() {
  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");
  const approved = getApprovedModules(registry);
  const session = await auth();
  const exercises = session?.user?.id ? await getTodaysTraining(session.user.id) : null;
  const streak = session?.user?.id ? await getStreakStatus(session.user.id) : null;
  const trainingLevel = session?.user?.id ? await getTrainingLevelStatus(session.user.id) : null;
  const firstName = session?.user?.name?.split(" ")[0];

  const quickLinks: QuickLink[] = [
    { href: "/progress", label: "View progress →", icon: CHART_ICON },
    { href: "/science", label: "See the science →", icon: FLASK_ICON },
    { href: "/achievements", label: "View achievements →", icon: TROPHY_ICON },
    { href: "/challenges", label: "View weekly challenges →", icon: TARGET_ICON },
    { href: "/train/n-back", label: "Try the N-Back exercise →", domain: "WORKING_MEMORY" },
    { href: "/train/complex-span", label: "Try the Complex Span exercise →", domain: "WORKING_MEMORY" },
    { href: "/train/dice-sum", label: "Try the Dice Sum exercise →", domain: "WORKING_MEMORY" },
    { href: "/train/spatial-sequence", label: "Try the Spatial Sequence exercise →", domain: "SPATIAL" },
    { href: "/train/reading", label: "Try the Paced Reading exercise →", domain: "READING" },
  ];

  return (
    <main className="flex-1 flex flex-col items-center p-6">
      <div className="flex w-full max-w-[390px] flex-col gap-5">
        <h1 className="font-display text-[21px] font-bold text-text">
          {session?.user ? (firstName ? `Welcome back, ${firstName}` : "Welcome back") : "LeanAcademy"}
        </h1>

        {session?.user ? (
          <>
            {(streak && streak.currentStreakDays > 0) || trainingLevel ? (
              <div className="flex flex-wrap items-center gap-2">
                {streak && streak.currentStreakDays > 0 ? (
                  <div
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                    style={{ background: "var(--color-caution-soft)", color: "var(--color-caution)" }}
                    data-testid="streak-indicator"
                  >
                    <span aria-hidden="true">🔥</span>
                    <span>
                      {streak.currentStreakDays}-day streak
                      {!streak.trainedToday ? " — ready to continue your training?" : ""}
                    </span>
                  </div>
                ) : null}
                {trainingLevel ? (
                  <div
                    className="rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                    style={{ background: "var(--color-accent-soft)", color: "var(--color-accent-strong)" }}
                  >
                    <span data-testid="training-level-indicator">Training Level {trainingLevel.level}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {exercises && exercises.length > 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
                <div className="mb-4 text-[12px] font-bold tracking-wide text-text-3">TODAY&rsquo;S TRAINING</div>
                <div className="mb-5 flex flex-col gap-3">
                  {exercises.map((e) => (
                    <div key={e.method} className="flex items-center gap-3">
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
                        {DOMAIN_LABELS[e.domain] ?? e.displayName}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/train/session"
                  className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent transition-transform active:scale-[0.98]"
                >
                  Start Training
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
                <div className="mb-3 text-sm text-text-2">
                  Complete onboarding to get a training plan built around your goals.
                </div>
                <Link
                  href="/onboarding"
                  className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent transition-transform active:scale-[0.98]"
                >
                  Start onboarding
                </Link>
              </div>
            )}

            <div>
              <div className="mb-2.5 text-[12px] font-bold tracking-wide text-text-3">QUICK LINKS</div>
              <div className="grid grid-cols-2 gap-2.5">
                {quickLinks.map((q) => (
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
          </>
        ) : (
          <Link
            href="/login"
            className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
          >
            Log in or sign up →
          </Link>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface p-4 text-[12px] text-text-3">
          <dt>Evidence registry last reviewed</dt>
          <dd className="text-right text-text-2">{registry.lastReviewed}</dd>
          <dt>Approved training modules</dt>
          <dd className="text-right text-text-2">{approved.length}</dd>
          <dt>Signed in</dt>
          <dd className="text-right text-text-2">{session?.user ? session.user.email : "no"}</dd>
        </dl>
      </div>
    </main>
  );
}

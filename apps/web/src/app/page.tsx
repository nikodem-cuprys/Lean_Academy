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

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">LeanAcademy</h1>

      {session?.user ? (
        <div className="flex w-full max-w-sm flex-col gap-4 text-left">
          <div className="flex items-center gap-3 text-[13.5px] font-semibold text-text-2">
            {streak && streak.currentStreakDays > 0 ? (
              <div className="flex items-center gap-2" data-testid="streak-indicator">
                <span aria-hidden="true">🔥</span>
                <span>
                  {streak.currentStreakDays}-day streak
                  {!streak.trainedToday ? " — ready to continue your training?" : ""}
                </span>
              </div>
            ) : null}
            {streak && streak.currentStreakDays > 0 && trainingLevel ? (
              <div className="h-3.5 w-px bg-border" aria-hidden="true" />
            ) : null}
            {trainingLevel ? (
              <span data-testid="training-level-indicator">Training Level {trainingLevel.level}</span>
            ) : null}
          </div>

          {exercises && exercises.length > 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <div className="mb-1 text-[12px] font-bold tracking-wide text-text-3">TODAY&rsquo;S TRAINING</div>
              <div className="mb-4 flex flex-col gap-2.5">
                {exercises.map((e) => (
                  <div key={e.method} className="flex items-center gap-2.5">
                    <div
                      className="h-[26px] w-[26px] flex-shrink-0 rounded-md"
                      style={{ background: `var(--color-${DOMAIN_COLOR_CLASS[e.domain]}-soft)` }}
                    />
                    <div className="flex-1 text-sm font-semibold text-text">
                      {DOMAIN_LABELS[e.domain] ?? e.displayName}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/train/session"
                className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
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
                className="block w-full rounded-full bg-accent py-3 text-center font-body text-[15px] font-bold text-on-accent"
              >
                Start onboarding
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-2 text-center text-sm">
            <Link href="/progress" className="font-semibold text-accent underline">
              View progress →
            </Link>
            <Link href="/science" className="font-semibold text-accent underline">
              See the science →
            </Link>
            <Link href="/achievements" className="font-semibold text-accent underline">
              View achievements →
            </Link>
            <Link href="/challenges" className="font-semibold text-accent underline">
              View weekly challenges →
            </Link>
            <Link href="/train/n-back" className="font-semibold text-accent underline">
              Try the N-Back exercise →
            </Link>
            <Link href="/train/complex-span" className="font-semibold text-accent underline">
              Try the Complex Span exercise →
            </Link>
            <Link href="/train/spatial-sequence" className="font-semibold text-accent underline">
              Try the Spatial Sequence exercise →
            </Link>
            <Link href="/train/reading" className="font-semibold text-accent underline">
              Try the Paced Reading exercise →
            </Link>
          </div>
        </div>
      ) : (
        <Link href="/login" className="text-sm font-semibold text-accent underline">
          Log in or sign up →
        </Link>
      )}

      <dl className="text-sm text-left border rounded-lg p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-text-3">Evidence registry last reviewed</dt>
        <dd>{registry.lastReviewed}</dd>
        <dt className="text-text-3">Approved training modules</dt>
        <dd>{approved.length}</dd>
        <dt className="text-text-3">Signed in</dt>
        <dd>{session?.user ? session.user.email : "no"}</dd>
      </dl>
    </main>
  );
}

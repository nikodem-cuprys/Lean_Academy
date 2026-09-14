/**
 * The Achievements catalog (Phase 5 — see docs/kanban.md's Achievements
 * card). Exactly the 11 real, checkable milestones `prototype/
 * Achievements.dc.html` specifies — `project_prompt.txt`'s own list
 * names a 12th ("completed first transfer assessment"), which the
 * prototype itself already dropped since no transfer-assessment
 * mechanic exists yet; don't add it back without that mechanic first.
 *
 * Shared between `prisma/seed.ts` (which upserts these rows by `key`)
 * and `apps/web/src/lib/achievements.ts` (which awards `UserAchievement`
 * rows against the same keys) so the two can never drift out of sync —
 * a typo'd key here would silently mean an achievement is never
 * awarded, or never seeded.
 *
 * Every title/description is spot-checked against `project_prompt.txt`'s
 * SCIENTIFIC PROGRESS LANGUAGE section: each one names a real, checkable
 * action or performance result, never an unsupported claim like the
 * anti-example "10% smarter."
 */
export interface AchievementCatalogEntry {
  key: string;
  title: string;
  description: string;
  iconKey: string;
}

export const ACHIEVEMENT_CATALOG: AchievementCatalogEntry[] = [
  { key: "first-session", title: "First Session", description: "Completed your first training session.", iconKey: "star" },
  { key: "first-week", title: "First Week", description: "Trained for 7 days in a row.", iconKey: "flame" },
  { key: "sessions-10", title: "10 Sessions", description: "Completed 10 training sessions.", iconKey: "star" },
  { key: "sessions-30", title: "30 Sessions", description: "Completed 30 training sessions.", iconKey: "star" },
  { key: "sessions-100", title: "100 Sessions", description: "Completed 100 training sessions.", iconKey: "star" },
  { key: "working-memory-level-5", title: "Working Memory Level 5", description: "Reached level 5 on a working memory exercise.", iconKey: "dots" },
  { key: "reading-efficiency-milestone", title: "Reading Efficiency Milestone", description: "Increased your reading pace beyond where you started.", iconKey: "book" },
  {
    key: "reading-comprehension-at-new-pace",
    title: "Maintained 90% comprehension at a new pace",
    description: "Kept comprehension at 90% or higher right after your reading pace increased.",
    iconKey: "book",
  },
  { key: "weekly-sessions-complete", title: "Completed all weekly sessions", description: "Completed your training sessions for the week.", iconKey: "list" },
  { key: "personal-best", title: "Personal Best", description: "Reached a new personal best on an exercise.", iconKey: "target" },
  { key: "first-assessment", title: "Completed first assessment", description: "Completed your first calibration assessment.", iconKey: "check" },
];

import { prisma, ACHIEVEMENT_CATALOG } from "@lean-academy/db";
import { SESSION_COUNT_MILESTONES, WEEKLY_SESSION_TARGET, startOfUtcWeek } from "@/lib/achievements";

// Read side for the /achievements page — mirrors apps/web/src/lib/
// progress-data.ts's pattern (a plain data-fetching function the page
// server-component calls, consumed by a presentational View
// component). Progress bars are only computed for the three milestones
// that have a natural running count (10/30/100 Sessions and the weekly
// target) — every other achievement is earned/not-earned, matching
// prototype/Achievements.dc.html exactly (it never shows a bar for,
// say, "Reading Efficiency Milestone").

export interface AchievementStatus {
  key: string;
  title: string;
  description: string;
  iconKey: string;
  earned: boolean;
  earnedAt: string | null;
  contextLabel: string | null;
  progressCurrent: number | null;
  progressTarget: number | null;
}

export async function getAchievementsStatus(userId: string, now: Date = new Date()): Promise<AchievementStatus[]> {
  const [userAchievements, completedCount, weekCount, taskDefinitions] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
    prisma.trainingSession.count({ where: { userId, status: "COMPLETED" } }),
    prisma.trainingSession.count({ where: { userId, status: "COMPLETED", completedAt: { gte: startOfUtcWeek(now) } } }),
    prisma.taskDefinition.findMany(),
  ]);

  const earnedByKey = new Map(userAchievements.map((ua) => [ua.achievement.key, ua]));
  const displayNameByMethod = new Map(taskDefinitions.map((t) => [t.method, t.displayName]));
  // Every 10/30/100-sessions milestone still ahead gets its own bar
  // against the real completed-session count — matching
  // prototype/Achievements.dc.html, which shows "23 of 30" and
  // "23 of 100" side by side, not just the nearest one.
  const sessionMilestoneByKey = new Map(
    SESSION_COUNT_MILESTONES.filter((m) => m.key !== "first-session").map((m) => [m.key, m.count])
  );

  return ACHIEVEMENT_CATALOG.map((entry) => {
    const earned = earnedByKey.get(entry.key);
    const metadata = earned?.metadata as { method?: string } | null | undefined;
    const contextLabel = metadata?.method ? displayNameByMethod.get(metadata.method) ?? null : null;

    let progressCurrent: number | null = null;
    let progressTarget: number | null = null;
    if (!earned) {
      if (entry.key === "weekly-sessions-complete") {
        progressCurrent = weekCount;
        progressTarget = WEEKLY_SESSION_TARGET;
      } else if (sessionMilestoneByKey.has(entry.key)) {
        progressCurrent = completedCount;
        progressTarget = sessionMilestoneByKey.get(entry.key)!;
      }
    }

    return {
      key: entry.key,
      title: entry.title,
      description: entry.description,
      iconKey: entry.iconKey,
      earned: !!earned,
      earnedAt: earned ? earned.earnedAt.toISOString() : null,
      contextLabel,
      progressCurrent,
      progressTarget,
    };
  });
}

export interface LatestAchievement {
  title: string;
  earnedAt: string;
}

/**
 * The single most recently earned real achievement, for the desktop
 * dashboard's "Recent achievement" card (see prototype/HomeDesktop.dc.html)
 * — null when the user hasn't earned one yet, never a placeholder.
 */
export async function getLatestEarnedAchievement(userId: string): Promise<LatestAchievement | null> {
  const latest = await prisma.userAchievement.findFirst({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    include: { achievement: true },
  });
  if (!latest) return null;
  return { title: latest.achievement.title, earnedAt: latest.earnedAt.toISOString() };
}

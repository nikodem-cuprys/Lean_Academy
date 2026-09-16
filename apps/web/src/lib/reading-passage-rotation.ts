import { prisma } from "@lean-academy/db";
import { READING_PASSAGES, type Passage } from "@lean-academy/reading-engine";

/**
 * Real rotation for docs/kanban.md's "Expand and rotate the
 * reading-passage bank" card: orders the passage bank so the
 * least-recently-seen passage for this specific user comes first,
 * computed from real Trial history rather than the fixed/sequential
 * order the exercise used before. A passage the user has never read
 * counts as more "least recently seen" than any passage they have
 * read, so first-timers (and any passage newly added to the bank)
 * surface before repeats.
 */

const READING_METHOD = "reading-paced-adaptive-v0";

/** Extracts the passage id a reading Trial's metadata recorded it was read from — see PacedReadingExercise.tsx's trial metadata. */
export function passageIdFromMetadata(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "passageId" in metadata) {
    const value = (metadata as { passageId?: unknown }).passageId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

export async function getLeastRecentlySeenPassageOrder(userId: string): Promise<Passage[]> {
  const taskVersion = await prisma.taskVersion.findFirst({
    where: { taskDefinition: { method: READING_METHOD } },
    orderBy: { releasedAt: "desc" },
  });
  if (!taskVersion) return READING_PASSAGES; // seed hasn't run for this task yet — declared order is as good as any

  const trials = await prisma.trial.findMany({
    where: { taskVersionId: taskVersion.id, trainingSession: { userId } },
    orderBy: { stimulusStartedAt: "desc" },
    select: { metadata: true },
  });

  // Walk most-recent-first; the first time a passage id is seen in this
  // scan is its most recent reading, so a passage encountered deeper
  // into the scan was read longer ago.
  const recencyRank = new Map<string, number>();
  let rank = 0;
  for (const trial of trials) {
    const passageId = passageIdFromMetadata(trial.metadata);
    if (passageId && !recencyRank.has(passageId)) {
      recencyRank.set(passageId, rank);
      rank++;
    }
  }

  const neverSeen = READING_PASSAGES.filter((p) => !recencyRank.has(p.id));
  const seen = READING_PASSAGES.filter((p) => recencyRank.has(p.id)).sort(
    (a, b) => recencyRank.get(b.id)! - recencyRank.get(a.id)!
  );
  return [...neverSeen, ...seen];
}

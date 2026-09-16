import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLeastRecentlySeenPassageOrder } from "@/lib/reading-passage-rotation";

// PacedReadingExercise (client component — no direct DB access) fetches
// this once on mount to seed PacedReadingTask's passagePool with the
// real per-user least-recently-seen order, rather than the fixed
// declared order — see docs/kanban.md's "Expand and rotate the
// reading-passage bank" card.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const order = await getLeastRecentlySeenPassageOrder(session.user.id);
  return NextResponse.json({ order: order.map((p) => p.id) });
}

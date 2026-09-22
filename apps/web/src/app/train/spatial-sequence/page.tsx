import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpatialSequenceExercise } from "@/components/SpatialSequenceExercise";
import { getPacePreference, getGridSizePreference } from "@/lib/exercise-preferences";

export default async function SpatialSequencePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [pace, gridSize] = await Promise.all([
    getPacePreference(session.user.id, "visuospatial-sequence-recall-v0"),
    getGridSizePreference(session.user.id),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center">
      <SpatialSequenceExercise pace={pace} gridSize={gridSize} />
    </main>
  );
}

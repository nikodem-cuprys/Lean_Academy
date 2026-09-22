import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpatialSequenceExercise } from "@/components/SpatialSequenceExercise";
import { getPacePreference } from "@/lib/exercise-preferences";

export default async function SpatialSequencePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const pace = await getPacePreference(session.user.id, "visuospatial-sequence-recall-v0");

  return (
    <main className="flex flex-1 flex-col items-center">
      <SpatialSequenceExercise pace={pace} />
    </main>
  );
}

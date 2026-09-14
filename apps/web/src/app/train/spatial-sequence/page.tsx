import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SpatialSequenceExercise } from "@/components/SpatialSequenceExercise";

export default async function SpatialSequencePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <SpatialSequenceExercise />
    </main>
  );
}

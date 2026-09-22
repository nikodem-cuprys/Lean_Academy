import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NBackExercise } from "@/components/NBackExercise";
import { getPacePreference } from "@/lib/exercise-preferences";

export default async function NBackPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const pace = await getPacePreference(session.user.id, "adaptive-nback-v0");

  return (
    <main className="flex flex-1 flex-col items-center">
      <NBackExercise pace={pace} />
    </main>
  );
}

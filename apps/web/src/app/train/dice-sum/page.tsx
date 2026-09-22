import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DiceSumExercise } from "@/components/DiceSumExercise";
import { getDieSidesPreference } from "@/lib/exercise-preferences";

export default async function DiceSumPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const dieSides = await getDieSidesPreference(session.user.id);

  return (
    <main className="flex flex-1 flex-col items-center">
      <DiceSumExercise dieSides={dieSides} />
    </main>
  );
}

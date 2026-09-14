import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTodaysTraining } from "@/lib/todays-training";
import { TrainingSessionRunner } from "@/components/TrainingSessionRunner";

export default async function TrainingSessionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const exercises = await getTodaysTraining(session.user.id);
  if (!exercises || exercises.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <TrainingSessionRunner exercises={exercises} />
    </main>
  );
}

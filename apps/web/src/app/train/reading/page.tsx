import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PacedReadingExercise } from "@/components/PacedReadingExercise";

export default async function ReadingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <PacedReadingExercise />
    </main>
  );
}

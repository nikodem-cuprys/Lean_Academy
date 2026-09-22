import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ComplexSpanExercise } from "@/components/ComplexSpanExercise";
import { getPacePreference } from "@/lib/exercise-preferences";

export default async function ComplexSpanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const pace = await getPacePreference(session.user.id, "complex-span-v0");

  return (
    <main className="flex flex-1 flex-col items-center">
      <ComplexSpanExercise pace={pace} />
    </main>
  );
}

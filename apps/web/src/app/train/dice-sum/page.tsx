import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DiceSumExercise } from "@/components/DiceSumExercise";

export default async function DiceSumPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <DiceSumExercise />
    </main>
  );
}

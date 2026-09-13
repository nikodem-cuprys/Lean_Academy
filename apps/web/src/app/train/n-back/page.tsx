import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NBackExercise } from "@/components/NBackExercise";

export default async function NBackPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <NBackExercise />
    </main>
  );
}

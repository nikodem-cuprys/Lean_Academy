import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ComplexSpanExercise } from "@/components/ComplexSpanExercise";

export default async function ComplexSpanPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <ComplexSpanExercise />
    </main>
  );
}

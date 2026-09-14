import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProgressData } from "@/lib/progress-data";
import { ProgressView } from "@/components/ProgressView";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getProgressData(session.user.id);

  return (
    <main className="flex flex-1 flex-col items-center">
      <ProgressView data={data} />
    </main>
  );
}

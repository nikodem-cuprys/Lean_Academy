import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAchievementsStatus } from "@/lib/achievements-data";
import { AchievementsView } from "@/components/AchievementsView";

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const achievements = await getAchievementsStatus(session.user.id);

  return (
    <main className="flex flex-1 flex-col items-center">
      <AchievementsView achievements={achievements} />
    </main>
  );
}

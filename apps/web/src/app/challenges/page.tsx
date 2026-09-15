import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWeeklyChallengesStatus } from "@/lib/weekly-challenges";
import { ChallengesView } from "@/components/ChallengesView";

export default async function ChallengesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const challenges = await getWeeklyChallengesStatus(session.user.id);

  return (
    <main className="flex flex-1 flex-col items-center">
      <ChallengesView challenges={challenges} />
    </main>
  );
}

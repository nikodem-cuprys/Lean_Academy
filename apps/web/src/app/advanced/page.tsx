import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCustomizedMethods, getRecentAdvancedRuns } from "@/lib/advanced-runs";
import { AdvancedHubView } from "@/components/AdvancedHubView";

export default async function AdvancedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [customized, recentRuns] = await Promise.all([
    getCustomizedMethods(session.user.id),
    getRecentAdvancedRuns(session.user.id, { limit: 10 }),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center">
      <AdvancedHubView customized={customized} recentRuns={recentRuns} />
    </main>
  );
}

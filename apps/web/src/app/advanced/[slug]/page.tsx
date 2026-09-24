import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { methodFromSlug } from "@/lib/advanced-settings";
import { getAdvancedSettings, getRecentAdvancedRuns } from "@/lib/advanced-runs";
import { AdvancedLessonView } from "@/components/AdvancedLessonView";

export default async function AdvancedLessonPage({ params }: PageProps<"/advanced/[slug]">) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const method = methodFromSlug((await params).slug);
  if (!method) {
    notFound();
  }

  const [settings, recentRuns] = await Promise.all([
    getAdvancedSettings(session.user.id, method),
    getRecentAdvancedRuns(session.user.id, { method, limit: 5 }),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center">
      <AdvancedLessonView method={method} initialSettings={settings} initialRuns={recentRuns} />
    </main>
  );
}

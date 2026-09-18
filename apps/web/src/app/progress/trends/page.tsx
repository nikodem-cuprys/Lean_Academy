import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPremiumUser } from "@/lib/entitlements";
import { getTrendData, TREND_MIN_SESSIONS, TREND_MIN_SPAN_DAYS } from "@/lib/trend-data";
import { LongitudinalTrendsView } from "@/components/LongitudinalTrendsView";
import { PremiumRequired } from "@/components/PremiumRequired";

export default async function TrendsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isPremiumUser(session.user.id))) {
    return (
      <main className="flex flex-1 flex-col items-center">
        <PremiumRequired featureName="Long-term trends" />
      </main>
    );
  }

  const { taskTrends, reading } = await getTrendData(session.user.id);

  return (
    <main className="flex flex-1 flex-col items-center">
      <LongitudinalTrendsView
        taskTrends={taskTrends}
        reading={reading}
        minSessions={TREND_MIN_SESSIONS}
        minSpanDays={TREND_MIN_SPAN_DAYS}
      />
    </main>
  );
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import {
  getNearTransferAssessmentStatus,
  BACKWARD_SPATIAL_SPAN_ASSESSMENT_NAME,
} from "@/lib/near-transfer-assessment";
import { isPremiumUser } from "@/lib/entitlements";
import { BackwardSpatialSpanAssessment } from "@/components/BackwardSpatialSpanAssessment";
import { PremiumRequired } from "@/components/PremiumRequired";

export default async function BackwardSpatialSpanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isPremiumUser(session.user.id))) {
    const t = await getTranslations("premium.features");
    return (
      <main className="flex flex-1 flex-col items-center">
        <PremiumRequired featureName={t("backwardSpatialSpan")} />
      </main>
    );
  }

  const status = await getNearTransferAssessmentStatus(session.user.id, BACKWARD_SPATIAL_SPAN_ASSESSMENT_NAME);

  return (
    <main className="flex flex-1 flex-col items-center">
      <BackwardSpatialSpanAssessment
        status={{
          lastTakenAt: status.lastTakenAt?.toISOString() ?? null,
          isDue: status.isDue,
          nextDueAt: status.nextDueAt?.toISOString() ?? null,
        }}
      />
    </main>
  );
}

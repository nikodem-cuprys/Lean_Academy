import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import {
  getNearTransferAssessmentStatus,
  BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME,
} from "@/lib/near-transfer-assessment";
import { isPremiumUser } from "@/lib/entitlements";
import { BackwardDigitSpanAssessment } from "@/components/BackwardDigitSpanAssessment";
import { PremiumRequired } from "@/components/PremiumRequired";

export default async function BackwardDigitSpanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!(await isPremiumUser(session.user.id))) {
    const t = await getTranslations("premium.features");
    return (
      <main className="flex flex-1 flex-col items-center">
        <PremiumRequired featureName={t("backwardDigitSpan")} />
      </main>
    );
  }

  const status = await getNearTransferAssessmentStatus(session.user.id, BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME);

  return (
    <main className="flex flex-1 flex-col items-center">
      <BackwardDigitSpanAssessment
        status={{
          lastTakenAt: status.lastTakenAt?.toISOString() ?? null,
          isDue: status.isDue,
          nextDueAt: status.nextDueAt?.toISOString() ?? null,
        }}
      />
    </main>
  );
}

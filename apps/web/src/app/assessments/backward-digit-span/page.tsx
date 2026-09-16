import { redirect } from "next/navigation";
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
    return (
      <main className="flex flex-1 flex-col items-center">
        <PremiumRequired featureName="The Backward Digit Span assessment" />
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

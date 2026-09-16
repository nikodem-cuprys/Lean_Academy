import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getNearTransferAssessmentStatus,
  BACKWARD_DIGIT_SPAN_ASSESSMENT_NAME,
} from "@/lib/near-transfer-assessment";
import { BackwardDigitSpanAssessment } from "@/components/BackwardDigitSpanAssessment";

export default async function BackwardDigitSpanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
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

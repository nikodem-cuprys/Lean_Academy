import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getNearTransferAssessmentStatus,
  BACKWARD_SPATIAL_SPAN_ASSESSMENT_NAME,
} from "@/lib/near-transfer-assessment";
import { BackwardSpatialSpanAssessment } from "@/components/BackwardSpatialSpanAssessment";

export default async function BackwardSpatialSpanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
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

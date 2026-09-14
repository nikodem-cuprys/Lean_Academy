import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center">
      <OnboardingFlow />
    </main>
  );
}

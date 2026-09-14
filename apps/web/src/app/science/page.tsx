import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getScienceData } from "@/lib/science-data";
import { ScienceView } from "@/components/ScienceView";

export default async function SciencePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const data = await getScienceData();

  return (
    <main className="flex flex-1 flex-col items-center">
      <ScienceView data={data} />
    </main>
  );
}

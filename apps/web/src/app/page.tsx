import Link from "next/link";
import { parseEvidenceRegistry, getApprovedModules } from "@lean-academy/evidence";
import { auth } from "@/lib/auth";
// Imported (not read via fs) because Next's server bundle virtualizes
// __dirname, which breaks the fs-based loadEvidenceRegistry — see the
// comment on parseEvidenceRegistry in packages/evidence.
import registryJson from "../../../../data/evidence-registry.json";

// Phase 2 scaffold placeholder — not the real Home screen from
// prototype/Home.dc.html yet. This exists to prove the workspace wires
// together end to end (evidence registry + auth session), per the
// "Repository & Monorepo Scaffold" kanban card's acceptance criteria.
export default async function HomePage() {
  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");
  const approved = getApprovedModules(registry);
  const session = await auth();

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">LeanAcademy</h1>
      <p className="text-sm text-neutral-500 max-w-md">
        Phase 2 scaffold. The real Home screen is designed in{" "}
        <code>prototype/Home.dc.html</code> — this page just proves the
        workspace packages are wired together.
      </p>
      <dl className="text-sm text-left border rounded-lg p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-neutral-500">Evidence registry last reviewed</dt>
        <dd>{registry.lastReviewed}</dd>
        <dt className="text-neutral-500">Approved training modules</dt>
        <dd>{approved.length}</dd>
        <dt className="text-neutral-500">Signed in</dt>
        <dd>{session?.user ? session.user.email : "no"}</dd>
      </dl>
      {session?.user ? (
        <div className="flex flex-col gap-2">
          <Link href="/onboarding" className="text-sm font-semibold text-accent underline">
            Start onboarding →
          </Link>
          <Link href="/train/n-back" className="text-sm font-semibold text-accent underline">
            Try the N-Back exercise →
          </Link>
          <Link href="/train/complex-span" className="text-sm font-semibold text-accent underline">
            Try the Complex Span exercise →
          </Link>
          <Link href="/train/spatial-sequence" className="text-sm font-semibold text-accent underline">
            Try the Spatial Sequence exercise →
          </Link>
          <Link href="/train/reading" className="text-sm font-semibold text-accent underline">
            Try the Paced Reading exercise →
          </Link>
        </div>
      ) : (
        <Link href="/login" className="text-sm font-semibold text-accent underline">
          Log in or sign up →
        </Link>
      )}
    </main>
  );
}

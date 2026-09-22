import { redirect } from "next/navigation";
import { parseEvidenceRegistry, getApprovedModules } from "@lean-academy/evidence";
import { auth } from "@/lib/auth";
import { getAllExercisePreferences, PACED_METHODS, DICE_METHOD, SPATIAL_METHOD, type PacedMethod } from "@/lib/exercise-preferences";
import { ExerciseSettingsView } from "@/components/ExerciseSettingsView";
// Imported (not read via fs) — same reason page.tsx already documents:
// Next's server bundle virtualizes __dirname, breaking the fs-based
// loadEvidenceRegistry. See parseEvidenceRegistry's own comment.
import registryJson from "../../../../../../data/evidence-registry.json";

export default async function ExerciseSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");
  const approved = getApprovedModules(registry);
  const displayNameByMethod = new Map(approved.map((m) => [m.method, m.displayName]));

  const preferences = await getAllExercisePreferences(session.user.id);

  const pacedExercises = PACED_METHODS.map((method: PacedMethod) => ({
    method,
    displayName: displayNameByMethod.get(method) ?? method,
    pace: preferences.pace[method],
  }));

  const diceExercise = {
    method: DICE_METHOD,
    displayName: displayNameByMethod.get(DICE_METHOD) ?? "Dice Sum",
    dieSides: preferences.dieSides,
  };

  const spatialGridExercise = {
    method: SPATIAL_METHOD,
    displayName: displayNameByMethod.get(SPATIAL_METHOD) ?? "Spatial Sequence Recall",
    gridSize: preferences.gridSize,
  };

  return (
    <main className="flex flex-1 flex-col items-center">
      <ExerciseSettingsView pacedExercises={pacedExercises} diceExercise={diceExercise} spatialGridExercise={spatialGridExercise} />
    </main>
  );
}

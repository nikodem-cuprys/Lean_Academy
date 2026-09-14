/**
 * Syncs EvidenceRecord/ResearchCitation from data/evidence-registry.json —
 * the JSON file stays the reviewed source of truth (see the comment at
 * the top of schema.prisma); this script just mirrors it into the DB so
 * science-page queries and any future admin tooling can join against it
 * relationally. Re-run any time the registry changes; it's idempotent
 * (upserts by `method`, replaces citations wholesale each run).
 */
import { loadEvidenceRegistry } from "@lean-academy/evidence";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const registry = loadEvidenceRegistry();

  for (const mod of registry.modules) {
    const record = await prisma.evidenceRecord.upsert({
      where: { method: mod.method },
      create: {
        method: mod.method,
        evidenceLevel: mod.evidenceLevel.toUpperCase() as never,
        trainedTaskImprovement: mod.trainedTaskImprovement,
        nearTransfer: mod.nearTransfer,
        farTransfer: mod.farTransfer,
        productionApproved: mod.productionApproved,
        lastReviewed: new Date(registry.lastReviewed),
      },
      update: {
        evidenceLevel: mod.evidenceLevel.toUpperCase() as never,
        trainedTaskImprovement: mod.trainedTaskImprovement,
        nearTransfer: mod.nearTransfer,
        farTransfer: mod.farTransfer,
        productionApproved: mod.productionApproved,
        lastReviewed: new Date(registry.lastReviewed),
      },
    });

    await prisma.researchCitation.deleteMany({
      where: { evidenceRecordId: record.id },
    });
    if (mod.citations.length > 0) {
      await prisma.researchCitation.createMany({
        data: mod.citations.map((c) => ({
          evidenceRecordId: record.id,
          authors: c.authors,
          year: c.year,
          title: c.title,
          venue: c.venue,
          url: c.url,
        })),
      });
    }
  }

  console.log(`Synced ${registry.modules.length} evidence records.`);

  await seedImplementedTasks();
}

/**
 * TaskDefinition/TaskVersion rows for the exercises that actually have a
 * real engine + screen wired up in apps/web (not the whole evidence
 * registry — most of it is still unimplemented). Update this list as
 * more exercises ship; each `method` must match the evidence registry's
 * id for that module. version "1.0" is the only version so far for all
 * four — see schema.prisma's TaskVersion comment on why Trial/
 * DifficultyState reference a version, not a bare TaskDefinition.
 */
const IMPLEMENTED_TASKS = [
  { method: "adaptive-nback-v0", displayName: "Adaptive N-Back", domain: "WORKING_MEMORY" },
  { method: "complex-span-v0", displayName: "Complex Span", domain: "WORKING_MEMORY" },
  { method: "visuospatial-sequence-recall-v0", displayName: "Spatial Sequence Recall", domain: "SPATIAL" },
  { method: "reading-paced-adaptive-v0", displayName: "Paced / Adaptive Reading", domain: "READING" },
] as const;

async function seedImplementedTasks() {
  for (const task of IMPLEMENTED_TASKS) {
    const definition = await prisma.taskDefinition.upsert({
      where: { method: task.method },
      create: { method: task.method, displayName: task.displayName, domain: task.domain as never },
      update: { displayName: task.displayName, domain: task.domain as never },
    });

    await prisma.taskVersion.upsert({
      where: { taskDefinitionId_version: { taskDefinitionId: definition.id, version: "1.0" } },
      create: { taskDefinitionId: definition.id, version: "1.0" },
      update: {},
    });
  }

  console.log(`Synced ${IMPLEMENTED_TASKS.length} task definitions/versions.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

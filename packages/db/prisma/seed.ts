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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

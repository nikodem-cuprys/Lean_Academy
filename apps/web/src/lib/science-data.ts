import { prisma } from "@lean-academy/db";
import { parseEvidenceRegistry } from "@lean-academy/evidence";
import { titleCase } from "./text";
// Imported (not read via fs) — see the same comment on this import in
// apps/web/src/app/page.tsx.
import registryJson from "../../../../data/evidence-registry.json";

/**
 * Real data for the Science page (prototype/Science.dc.html) — renders
 * directly from data/evidence-registry.json via packages/evidence's
 * loader, per docs/kanban.md's Science page card ("no separate
 * hand-maintained copy"). The one thing the registry itself doesn't
 * know is which methods are actually implemented in the app yet
 * ("in your training" in the mockup) — that's cross-referenced from
 * the real TaskDefinition rows packages/db/prisma/seed.ts writes for
 * exactly the implemented exercises, not a second hardcoded list.
 */

export interface ScienceModule {
  method: string;
  displayName: string;
  targetConstruct: string;
  /** Title-cased evidenceLevel, e.g. "Moderate". */
  evidenceBadge: string;
  implemented: boolean;
}

export interface ScienceData {
  reviewedCount: number;
  implementedCount: number;
  excludedCount: number;
  /** Production-approved modules, implemented ones first. */
  approvedModules: ScienceModule[];
  excludedDisplayNames: string[];
}

export async function getScienceData(): Promise<ScienceData> {
  const registry = parseEvidenceRegistry(registryJson, "data/evidence-registry.json");

  const taskDefinitions = await prisma.taskDefinition.findMany({ select: { method: true } });
  const implementedMethods = new Set(taskDefinitions.map((t) => t.method));

  const modules: ScienceModule[] = registry.modules.map((m) => ({
    method: m.method,
    displayName: m.displayName,
    targetConstruct: m.targetConstruct,
    evidenceBadge: titleCase(m.evidenceLevel),
    implemented: implementedMethods.has(m.method),
  }));

  const approvedRegistryModules = registry.modules.filter((m) => m.productionApproved);
  const excludedRegistryModules = registry.modules.filter((m) => !m.productionApproved);

  const approvedModules = modules
    .filter((m) => approvedRegistryModules.some((r) => r.method === m.method))
    .sort((a, b) => Number(b.implemented) - Number(a.implemented));

  return {
    reviewedCount: modules.length,
    implementedCount: approvedModules.filter((m) => m.implemented).length,
    excludedCount: excludedRegistryModules.length,
    approvedModules,
    excludedDisplayNames: excludedRegistryModules.map((m) => m.displayName),
  };
}

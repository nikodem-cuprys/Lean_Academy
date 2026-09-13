import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evidenceRegistrySchema,
  type EvidenceModule,
  type EvidenceRegistry,
} from "./schema";

export * from "./schema";

const DEFAULT_REGISTRY_PATH = resolve(
  __dirname,
  "../../../data/evidence-registry.json"
);

/**
 * Validates already-loaded registry data (e.g. a bundler-imported JSON
 * module). Pure — no filesystem access — so it's safe to call from code
 * that gets bundled for a server runtime that virtualizes `__dirname`
 * (Next.js's server bundle rewrites it to a synthetic path, which breaks
 * fs-based resolution; see loadEvidenceRegistry below). apps/web imports
 * data/evidence-registry.json directly and calls this instead of
 * loadEvidenceRegistry.
 *
 * Fails loudly (throws) on a shape that doesn't match the schema, per
 * the "Evidence Registry Loader & Catalog Gate" kanban card: a malformed
 * registry must break the build, not ship silently.
 */
export function parseEvidenceRegistry(
  data: unknown,
  sourceDescription = "evidence registry"
): EvidenceRegistry {
  const result = evidenceRegistrySchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `${sourceDescription} does not match the expected schema:\n${result.error.toString()}`
    );
  }
  return result.data;
}

/**
 * Reads and validates data/evidence-registry.json from disk. Node-only —
 * use this from real Node processes (apps/api, scripts, tests). Do not
 * use it from code that a frontend bundler (Next.js, etc.) packages for
 * a server runtime; use parseEvidenceRegistry with a bundler-imported
 * JSON module there instead.
 */
export function loadEvidenceRegistry(
  path: string = DEFAULT_REGISTRY_PATH
): EvidenceRegistry {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (cause) {
    throw new Error(
      `Evidence registry not found at ${path}. Every training module must be registered in data/evidence-registry.json before it can be loaded.`,
      { cause }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Evidence registry at ${path} is not valid JSON.`, {
      cause,
    });
  }

  return parseEvidenceRegistry(parsed, `Evidence registry at ${path}`);
}

/**
 * The single gate the production exercise catalog must go through:
 * only modules explicitly marked productionApproved may ever be surfaced
 * to a client. See docs/product-requirements.md's Scientific requirements.
 */
export function getApprovedModules(
  registry: EvidenceRegistry
): EvidenceModule[] {
  return registry.modules.filter((module) => module.productionApproved);
}

export function findModule(
  registry: EvidenceRegistry,
  method: string
): EvidenceModule | undefined {
  return registry.modules.find((module) => module.method === method);
}

/**
 * Returns true only if the module exists in the registry AND is approved.
 * Use this (not a raw catalog lookup) anywhere the app decides whether an
 * exercise may load.
 */
export function isModuleApproved(
  registry: EvidenceRegistry,
  method: string
): boolean {
  return findModule(registry, method)?.productionApproved ?? false;
}

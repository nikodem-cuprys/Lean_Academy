import { z } from "zod";

/**
 * Mirrors the evidence scale defined in docs/evidence-review.md.
 * "unsupported" exists in the scale but should never appear on a
 * productionApproved module — see the catalog gate in index.ts.
 */
export const evidenceLevelSchema = z.enum([
  "strong",
  "moderate",
  "limited",
  "experimental",
  "unsupported",
]);

export const citationSchema = z.object({
  authors: z.string(),
  year: z.number().int(),
  title: z.string(),
  venue: z.string(),
  url: z.string().url(),
});

export const evidenceModuleSchema = z.object({
  method: z.string().min(1),
  displayName: z.string().min(1),
  targetConstruct: z.string().min(1),
  population: z.string().min(1),
  evidenceLevel: evidenceLevelSchema,
  trainedTaskImprovement: z.string(),
  nearTransfer: z.string(),
  farTransfer: z.string(),
  productionApproved: z.boolean(),
  userFacingClaimLimits: z.array(z.string()),
  limitations: z.array(z.string()),
  citations: z.array(citationSchema),
});

export const evidenceRegistrySchema = z.object({
  lastReviewed: z.string(),
  evidenceScale: z.record(z.string(), z.string()),
  modules: z.array(evidenceModuleSchema),
});

export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type EvidenceModule = z.infer<typeof evidenceModuleSchema>;
export type EvidenceRegistry = z.infer<typeof evidenceRegistrySchema>;

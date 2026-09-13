/**
 * The plain-language difficulty levels users choose between — never the
 * raw internal Difficulty number from @lean-academy/adaptive-engine.
 * See "INTUITIVE DIFFICULTY" / "INTUITIVE LEVEL SELECTION" in
 * project_prompt.txt: this list applies to every training module, not
 * just one exercise, and must stay in sync with the DifficultyLevel enum
 * in packages/db/prisma/schema.prisma.
 */
export const DIFFICULTY_LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
  "CUSTOM",
  "AUTO",
] as const;

export type DifficultyLevelKey = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LEVEL_LABELS: Record<DifficultyLevelKey, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
  CUSTOM: "Custom",
  AUTO: "Auto",
};

/** Training domains, matching TrainingDomain in packages/db's schema. */
export const TRAINING_DOMAINS = [
  "WORKING_MEMORY",
  "READING",
  "SPATIAL",
  "VERBAL",
  "COGNITIVE_CONTROL",
  "MEMORY_STRATEGY",
] as const;

export type TrainingDomainKey = (typeof TRAINING_DOMAINS)[number];

export const TRAINING_DOMAIN_LABELS: Record<TrainingDomainKey, string> = {
  WORKING_MEMORY: "Working Memory",
  READING: "Reading",
  SPATIAL: "Spatial Memory",
  VERBAL: "Verbal",
  COGNITIVE_CONTROL: "Cognitive Control",
  MEMORY_STRATEGY: "Memory Strategy",
};

import { prisma, Prisma } from "@lean-academy/db";
import {
  ADVANCED_METHODS,
  defaultAdvancedSettings,
  sanitizeAdvancedSettings,
  type AdvancedMethod,
  type AdvancedSettings,
} from "@/lib/advanced-settings";

// Server-side persistence for the Advanced tab — see advanced-settings.ts
// for why advanced lessons are kept apart from the main/daily training
// data entirely.
//
// Saved parameters live under an `advanced` key inside the same
// per-(user, method) ExercisePreference row the free /settings/exercises
// presets use, merged in rather than overwritten, so an advanced save
// never erases a pace/grid/die preset (or vice versa). The two are
// independent: presets drive the standalone /train/<exercise> routes,
// `advanced` drives only /advanced/<slug>.

export async function getAdvancedSettings(userId: string, method: AdvancedMethod): Promise<AdvancedSettings> {
  const row = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method } } });
  const stored = (row?.settings as { advanced?: unknown } | undefined)?.advanced;
  return stored === undefined ? defaultAdvancedSettings(method) : sanitizeAdvancedSettings(method, stored);
}

export async function setAdvancedSettings(userId: string, method: AdvancedMethod, raw: unknown): Promise<AdvancedSettings> {
  const advanced = sanitizeAdvancedSettings(method, raw);
  const existing = await prisma.exercisePreference.findUnique({ where: { userId_method: { userId, method } } });
  const merged = { ...((existing?.settings as Record<string, unknown> | undefined) ?? {}), advanced };
  await prisma.exercisePreference.upsert({
    where: { userId_method: { userId, method } },
    create: { userId, method, settings: merged as Prisma.InputJsonValue },
    update: { settings: merged as Prisma.InputJsonValue },
  });
  return advanced;
}

/** Whether this user has changed any advanced parameter from its default, per method — drives the "Custom" badge on /advanced. */
export async function getCustomizedMethods(userId: string): Promise<Record<AdvancedMethod, boolean>> {
  const rows = await prisma.exercisePreference.findMany({ where: { userId, method: { in: [...ADVANCED_METHODS] } } });
  const byMethod = new Map(rows.map((r) => [r.method, (r.settings as { advanced?: unknown }).advanced]));
  return Object.fromEntries(
    ADVANCED_METHODS.map((method) => {
      const stored = byMethod.get(method);
      if (stored === undefined) return [method, false];
      const current = sanitizeAdvancedSettings(method, stored);
      const defaults = defaultAdvancedSettings(method);
      return [method, Object.keys(defaults).some((k) => defaults[k] !== current[k])];
    })
  ) as Record<AdvancedMethod, boolean>;
}

export interface AdvancedRunInput {
  method: AdvancedMethod;
  settings: unknown;
  trialCount: number;
  correctCount: number;
  startLevel: number;
  endLevel: number;
  averageWpm?: number;
}

export async function recordAdvancedRun(userId: string, input: AdvancedRunInput): Promise<void> {
  await prisma.advancedRun.create({
    data: {
      userId,
      method: input.method,
      settings: sanitizeAdvancedSettings(input.method, input.settings) as Prisma.InputJsonValue,
      trialCount: input.trialCount,
      correctCount: input.correctCount,
      startLevel: input.startLevel,
      endLevel: input.endLevel,
      summary: input.averageWpm !== undefined ? { averageWpm: input.averageWpm } : Prisma.JsonNull,
    },
  });
}

export interface AdvancedRunRow {
  id: string;
  method: AdvancedMethod;
  settings: AdvancedSettings;
  trialCount: number;
  correctCount: number;
  startLevel: number;
  endLevel: number;
  averageWpm: number | null;
  createdAt: string;
}

export async function getRecentAdvancedRuns(userId: string, options: { method?: AdvancedMethod; limit?: number } = {}): Promise<AdvancedRunRow[]> {
  const rows = await prisma.advancedRun.findMany({
    where: { userId, ...(options.method ? { method: options.method } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 10,
  });
  return rows
    .filter((r): r is typeof r & { method: AdvancedMethod } => (ADVANCED_METHODS as readonly string[]).includes(r.method))
    .map((r) => {
      const summary = r.summary as { averageWpm?: unknown } | null;
      return {
        id: r.id,
        method: r.method,
        settings: sanitizeAdvancedSettings(r.method, r.settings),
        trialCount: r.trialCount,
        correctCount: r.correctCount,
        startLevel: r.startLevel,
        endLevel: r.endLevel,
        averageWpm: typeof summary?.averageWpm === "number" ? summary.averageWpm : null,
        createdAt: r.createdAt.toISOString(),
      };
    });
}

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __leanAcademyPrisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient. In dev, Next.js hot-reloads modules, which
 * would otherwise create a new client (and a new DB connection pool) on
 * every edit — stash it on `global` to survive reloads.
 */
export const prisma =
  global.__leanAcademyPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__leanAcademyPrisma = prisma;
}

export * from "@prisma/client";
export * from "./achievement-catalog";

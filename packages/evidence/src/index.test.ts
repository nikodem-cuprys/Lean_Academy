import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadEvidenceRegistry,
  getApprovedModules,
  isModuleApproved,
  findModule,
} from "./index";

describe("loadEvidenceRegistry", () => {
  it("loads and validates the real data/evidence-registry.json", () => {
    const registry = loadEvidenceRegistry();
    expect(registry.modules.length).toBeGreaterThan(0);
  });

  it("throws a descriptive error for a missing file", () => {
    expect(() =>
      loadEvidenceRegistry(join(tmpdir(), "does-not-exist.json"))
    ).toThrow(/not found/);
  });

  it("throws a descriptive error for invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "evidence-"));
    const path = join(dir, "bad.json");
    writeFileSync(path, "{ not valid json");
    expect(() => loadEvidenceRegistry(path)).toThrow(/not valid JSON/);
  });

  it("throws a descriptive error when the shape doesn't match the schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "evidence-"));
    const path = join(dir, "malformed.json");
    writeFileSync(path, JSON.stringify({ modules: [{ method: "x" }] }));
    expect(() => loadEvidenceRegistry(path)).toThrow(/does not match/);
  });
});

describe("getApprovedModules / isModuleApproved (the catalog gate)", () => {
  const registry = loadEvidenceRegistry();

  it("only returns modules explicitly marked productionApproved", () => {
    const approved = getApprovedModules(registry);
    expect(approved.length).toBeGreaterThan(0);
    expect(approved.every((m) => m.productionApproved)).toBe(true);
  });

  it("excludes the two modules known to be rejected on evidence grounds", () => {
    const approved = getApprovedModules(registry).map((m) => m.method);
    expect(approved).not.toContain("inhibition-flanker-gonogo-v0");
    expect(approved).not.toContain("rsvp-single-word-v0");
  });

  it("isModuleApproved is false for a rejected module, even though it exists in the registry", () => {
    expect(findModule(registry, "rsvp-single-word-v0")).toBeDefined();
    expect(isModuleApproved(registry, "rsvp-single-word-v0")).toBe(false);
  });

  it("isModuleApproved is false for a method id that isn't registered at all", () => {
    expect(isModuleApproved(registry, "not-a-real-module")).toBe(false);
  });

  it("isModuleApproved is true for a known-good module", () => {
    expect(isModuleApproved(registry, "adaptive-nback-v0")).toBe(true);
  });
});

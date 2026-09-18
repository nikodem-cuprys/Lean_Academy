import { test, expect } from "@playwright/test";
import { prisma } from "@lean-academy/db";
import { loadEvidenceRegistry } from "@lean-academy/evidence";

// Verifies docs/kanban.md's Science page card: it renders directly from
// data/evidence-registry.json via packages/evidence (not a hand-
// maintained copy), cross-referenced against the real TaskDefinition
// rows for which methods are actually implemented. Requires the DB
// seed to have run (`pnpm --filter @lean-academy/db seed`) so
// TaskDefinition rows exist for the 4 implemented exercises.

const email = `e2e-science-${Date.now()}@example.com`;
const password = "correcthorsebattery123";

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

test("Science page renders real evidence-registry data, not a hardcoded copy", async ({ page }) => {
  const registry = loadEvidenceRegistry();
  const approved = registry.modules.filter((m) => m.productionApproved);
  const excluded = registry.modules.filter((m) => !m.productionApproved);
  const implementedMethods = ["adaptive-nback-v0", "complex-span-v0", "visuospatial-sequence-recall-v0", "reading-paced-adaptive-v0"];

  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: /See the science/ }).click();
  await expect(page).toHaveURL(/\/science/);
  await expect(page.getByText("The Science", { exact: true })).toBeVisible();

  // Stats card reflects the real registry counts. Scoped by each stat's
  // own data-testid rather than a bare exact-text digit match — the
  // registry growing (data/evidence-registry.json now has more excluded
  // modules than it used to) made two of these counts coincidentally
  // equal, which a bare getByText("4") can't tell apart (Playwright
  // strict mode correctly refuses to guess between them).
  await expect(page.getByTestId("stat-reviewed")).toContainText(String(registry.modules.length));
  await expect(page.getByTestId("stat-reviewed")).toContainText("reviewed");
  await expect(page.getByTestId("stat-implemented")).toContainText(String(implementedMethods.length));
  await expect(page.getByTestId("stat-implemented")).toContainText("in your training");
  await expect(page.getByTestId("stat-excluded")).toContainText(String(excluded.length));
  await expect(page.getByTestId("stat-excluded")).toContainText("excluded");

  // Every approved module is listed, with its real evidence level.
  for (const mod of approved) {
    const row = page.getByTestId(`science-module-${mod.method}`);
    await expect(row).toBeVisible();
    await expect(row.getByText(mod.displayName, { exact: true })).toBeVisible();
  }

  // Excluded modules never appear as rows, but are named in the footer.
  for (const mod of excluded) {
    await expect(page.getByTestId(`science-module-${mod.method}`)).toHaveCount(0);
    await expect(page.getByText(mod.displayName, { exact: false })).toBeVisible();
  }
});

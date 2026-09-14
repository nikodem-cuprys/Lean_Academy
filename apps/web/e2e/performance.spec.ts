import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@lean-academy/db";

// Phase 4's Performance optimization card (see docs/kanban.md) —
// establishes the baseline docs/development-plan.md's Phase 4 exit
// criteria calls for ("Core Web Vitals-equivalent performance targets
// met"). No specific numeric target exists anywhere in this project's
// own docs (checked docs/product-requirements.md, docs/testing.md), so
// this uses Google's published Core Web Vitals "Good" thresholds — the
// closest relevant standard, same resolution as the responsive pass's
// WCAG 2.2 tap-target-size choice: LCP <= 2.5s, CLS <= 0.1.
//
// Also tracks the two targets docs/testing.md explicitly names beyond
// page load — route-transition time and exercise-startup time — and
// total transferred JS per page load, which is how the real core-js
// polyfill-bundle finding below was actually confirmed (a static
// bundle-size inspection alone can't tell you what's genuinely
// fetched on a cold load vs. only reachable through a dynamic-import
// boundary).

async function measureLcpAndCls(page: Page, url: string): Promise<{ lcp: number; cls: number }> {
  await page.addInitScript(() => {
    (window as unknown as { __vitals: { lcp: number; cls: number } }).__vitals = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) (window as unknown as { __vitals: { lcp: number; cls: number } }).__vitals.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) {
          (window as unknown as { __vitals: { lcp: number; cls: number } }).__vitals.cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number } }).__vitals);
}

async function measureTransferredBytes(page: Page, url: string): Promise<{ totalKB: number; jsKB: number; requestCount: number }> {
  let totalBytes = 0;
  let jsBytes = 0;
  let requestCount = 0;
  // content-length is unreliable here (Next serves several responses
  // chunked, with no content-length header at all) — read the actual
  // decoded body size instead, which is real either way.
  page.on("response", async (response) => {
    let body: Buffer;
    try {
      body = await response.body();
    } catch {
      return; // navigations/redirects with no body to read
    }
    totalBytes += body.length;
    requestCount += 1;
    if (response.url().split("?")[0].endsWith(".js")) jsBytes += body.length;
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  return { totalKB: Math.round(totalBytes / 1024), jsKB: Math.round(jsBytes / 1024), requestCount };
}

test("baseline: LCP and CLS across key logged-out pages (Core Web Vitals 'Good' thresholds)", async ({ page }) => {
  for (const url of ["/login", "/signup"]) {
    const { lcp, cls } = await measureLcpAndCls(page, url);
    expect(lcp, `${url} LCP`).toBeLessThan(2500);
    expect(cls, `${url} CLS`).toBeLessThan(0.1);
  }
});

test("baseline: LCP and CLS across key signed-in pages", async ({ page }) => {
  const email = `e2e-perf-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorsebattery123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  for (const url of ["/", "/progress", "/science"]) {
    const { lcp, cls } = await measureLcpAndCls(page, url);
    expect(lcp, `${url} LCP`).toBeLessThan(2500);
    expect(cls, `${url} CLS`).toBeLessThan(0.1);
  }

  await prisma.user.deleteMany({ where: { email } });
});

test("baseline: route-transition time (home -> N-Back exercise)", async ({ page }) => {
  const email = `e2e-perf-nav-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("E2E Bot");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorsebattery123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  const start = Date.now();
  await page.getByRole("link", { name: /Try the N-Back exercise/ }).click();
  await expect(page.getByTestId("respond-button")).toBeVisible();
  const transitionMs = Date.now() - start;

  // No project-specific number exists for this either; 1s is a
  // generous, clearly-perceptible-as-fast bar for an in-app route
  // change (no full page reload), not a tight budget.
  expect(transitionMs).toBeLessThan(1000);

  await prisma.user.deleteMany({ where: { email } });
});

test("baseline: total transferred JS on a cold page load stays reasonable", async ({ page }) => {
  const { totalKB, jsKB, requestCount } = await measureTransferredBytes(page, "/login");
  console.log(`/login cold load: ${totalKB}KB total (${jsKB}KB JS) across ${requestCount} requests`);
  // A generous ceiling for a single auth-form screen with no images —
  // not a tight budget, just a guard against something regressing to
  // multiple MB unnoticed.
  expect(jsKB).toBeLessThan(1024);
});

test("no unnecessary legacy-browser polyfill bundle ships to a modern browser", async ({ page }) => {
  // Confirms the apps/web/package.json browserslist fix actually works
  // at runtime, not just "looks right" in a static bundle inspection —
  // a chunk merely existing in .next/static/chunks doesn't prove it's
  // ever requested by a real page load.
  const jsUrls: string[] = [];
  page.on("response", (response) => {
    if (response.url().split("?")[0].endsWith(".js")) jsUrls.push(response.url());
  });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  let coreJsBytes = 0;
  for (const url of jsUrls) {
    const body = await (await page.request.get(url)).body();
    if (body.includes("core-js")) coreJsBytes += body.length;
  }
  console.log(`core-js bytes fetched on /login: ${coreJsBytes}`);
  expect(coreJsBytes).toBe(0);
});

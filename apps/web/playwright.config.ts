import { defineConfig, devices } from "@playwright/test";

// Points at a server you start yourself (see CLAUDE.md's Commands
// section) rather than an auto-managed webServer, since the app needs
// DATABASE_URL/NEXTAUTH_SECRET/etc. that are simpler to set once in the
// shell that boots `next dev`/`next start` than to thread through
// Playwright's webServer.command.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

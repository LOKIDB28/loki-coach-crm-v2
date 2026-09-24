import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Loaded here (not relied on from `next dev`'s own auto-load) so test
// files' own process.env reads (e.g. the ground-truth Supabase query in
// e2e/dashboard.spec.ts) see the same values - test worker processes
// inherit process.env from this config process.
loadEnv({ path: resolve(process.cwd(), ".env.local") });

/**
 * Runs against `next dev` (started automatically via webServer below),
 * which itself talks to loki-crm-prod through .env.local - there is no
 * separate test environment or database. Every e2e test in e2e/ is
 * read-only by design: navigation and assertions, never a create/update/
 * archive/delete. See e2e-auth-setup.ts for how the "authenticated"
 * project's storageState is produced.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "unauthenticated",
      testMatch: /login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testIgnore: /login\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Produced once by `npm run e2e:auth` (scripts/e2e-auth-setup.ts),
        // reused across runs - never regenerated automatically per run.
        storageState: "playwright/.auth/storageState.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

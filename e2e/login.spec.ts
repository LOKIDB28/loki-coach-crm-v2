import { test, expect } from "@playwright/test";

/**
 * Runs in the "unauthenticated" Playwright project (no storageState).
 * Read-only against loki-crm-prod via next dev - doesn't attempt to log
 * in itself (that's scripts/e2e-auth-setup.ts's job, run once outside the
 * normal test loop).
 */
test("login page renders the magic-link form", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByLabel("Courriel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir le lien" })).toBeVisible();
});

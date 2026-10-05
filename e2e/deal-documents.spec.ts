import { test, expect } from "@playwright/test";

/**
 * Authenticated, read-only - same convention as every other spec in this
 * directory (see playwright.config.ts: no separate test environment, this
 * talks to loki-crm-prod, so never a create/update/delete). Opens whichever
 * deal happens to be first, expands Section 6 (Gagné), and confirms the
 * Documents block mounted: label, upload button, and the count indicator
 * in its "N/10" shape. Never a fixed expected count (real prod data) and
 * never actually uploads a file.
 */
test("Section 6 (Gagné) shows the Documents block", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();

  await page.getByRole("button", { name: new RegExp("^6 · ") }).click();

  await expect(page.getByText("Documents", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter un document" })).toBeVisible();
  await expect(page.getByText(/^\d+\/10$/)).toBeVisible();
});

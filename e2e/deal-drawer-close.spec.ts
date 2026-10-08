import { test, expect } from "@playwright/test";

/**
 * Authenticated, read-only - same convention as every other spec in this
 * directory (see playwright.config.ts). Opens whichever deal happens to be
 * first; never asserts on data specific to one deal, only on the drawer's
 * own close behavior. Never clicks "Confirmer" on the close banner and
 * never submits any section's own "Enregistrer" - the stray edit made here
 * to dirty Section 1 is only ever discarded (via "Annuler" or by navigating
 * away), never saved.
 */
test("Escape closes the drawer when nothing is unsaved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Fermer" })).toBeHidden();
});

test("Escape asks for confirmation instead of closing when a section has unsaved edits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  // Section 1 (Prospect) always holds the "Source" field - its header
  // toggles open/closed on click, so only click it if it isn't already
  // open (true when this deal's current stage happens to be Prospect,
  // Section's own defaultOpen) - otherwise this click would collapse it.
  const sourceField = page.locator('input[role="combobox"]');
  if (!(await sourceField.isVisible())) {
    await page.getByRole("button", { name: new RegExp("^1 · ") }).click();
  }
  await sourceField.fill("e2e read-only check - never saved");
  // Filling opens SourceCombobox's own suggestion list. Tab away first so
  // ITS Escape handling (closes the list only, stopPropagation - see
  // SourceCombobox.tsx) doesn't absorb the very Escape this test means to
  // exercise - with the list already closed, this Escape reaches the
  // drawer's own general dirty-close-confirmation path instead.
  await page.keyboard.press("Tab");

  await page.keyboard.press("Escape");
  await expect(page.getByText("Fermer sans enregistrer")).toBeVisible();
  // Still open - the banner intercepted the close, it didn't happen.
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  // Dismiss without ever saving or confirming the close.
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Fermer sans enregistrer")).toBeHidden();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();
});

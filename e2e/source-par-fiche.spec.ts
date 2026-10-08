import { test, expect } from "@playwright/test";

/**
 * Authenticated, read-only - no contact/deal is ever created or modified.
 * Covers two things that are easy to silently regress: the Source
 * combobox's own Escape handling (must close only its own list, never the
 * modal underneath it - see SourceCombobox.tsx's layered-Escape comment),
 * and the toolbar's Source filter (narrows the grid, chip shows/clears).
 */

test("Escape with the Source list open in Nouveau client closes the list, not the modal", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deal-card").first().waitFor();

  await page.getByRole("button", { name: "Nouveau client" }).click();
  const submitButton = page.getByRole("button", { name: "Créer le client" });
  await expect(submitButton).toBeVisible();

  // Not page.getByRole("combobox") - a native <select> (Représentant,
  // Niveau d'intérêt) also carries an implicit "combobox" role, which would
  // make that locator ambiguous. role="combobox" as an explicit attribute
  // only exists on SourceCombobox's own input.
  const combobox = page.locator('input[role="combobox"]');
  await combobox.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  // The modal itself must still be open - this Escape belonged to the list.
  await expect(submitButton).toBeVisible();

  // A second Escape, with the list already closed, behaves normally and
  // closes the modal (no unsaved changes yet, so no confirmation banner).
  await page.keyboard.press("Escape");
  await expect(submitButton).toBeHidden();
});

test("Source filter narrows the grid and its chip clears it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deal-card").first().waitFor();

  const totalBefore = await page.getByTestId("deal-card").count();

  await page.getByRole("button", { name: "Source" }).click();
  const facebookOption = page.getByRole("option", { name: /^Facebook/ });
  await facebookOption.waitFor();
  await facebookOption.click();

  await expect(page.getByText(/^Source: Facebook/)).toBeVisible();
  const totalFiltered = await page.getByTestId("deal-card").count();
  expect(totalFiltered).toBeLessThanOrEqual(totalBefore);
  expect(totalFiltered).toBeGreaterThan(0);

  await page.getByLabel("Retirer le filtre").click();
  await expect(page.getByText(/^Source: Facebook/)).toBeHidden();
  await expect(page.getByTestId("deal-card")).toHaveCount(totalBefore);
});

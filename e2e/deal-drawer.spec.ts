import { test, expect } from "@playwright/test";

/**
 * Authenticated. Opens whichever deal happens to be first in the list -
 * read-only, never asserts on data specific to one deal (real prod data
 * changes), only on always-present structural elements: the drawer itself,
 * the always-visible "Historique & notes" block, and the 7 pipeline-stage
 * sections (Section.tsx renders "{code} · {title}" regardless of which
 * deal is open).
 */
test("opening a deal shows the drawer with its 7 pipeline sections", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();

  await page.getByTestId("deal-card").first().click();

  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historique & notes" })).toBeVisible();

  for (let code = 1; code <= 7; code++) {
    await expect(page.getByRole("button", { name: new RegExp(`^${code} · `) })).toBeVisible();
  }
});

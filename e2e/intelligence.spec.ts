import { test, expect } from "@playwright/test";

/**
 * Authenticated. Read-only - just confirms all 9 LOKI Intelligence widget
 * sections render their heading without an error banner appearing. Not a
 * check on the numbers/charts themselves (real prod data, no fixed
 * expected values), only that each widget mounted successfully.
 */
test("LOKI Intelligence loads all 9 widgets", async ({ page }) => {
  await page.goto("/intelligence");

  // The page's own fallback error text (intelligence/page.tsx's
  // getErrorMessage(err, "Erreur de chargement.") call) - absence of this
  // is a meaningful check on its own, since the heading assertions below
  // are static JSX and would still pass even if the underlying fetch failed.
  await expect(page.getByText("Erreur de chargement.")).toHaveCount(0);

  const widgetHeadings = [
    "Funnel du pipeline",
    "Contacts par province / état",
    "Carte des contacts par province/état",
    "Répartition par source",
    "Forecast pondéré",
    "Forecast par vendeur et par étape",
    "Répartition par taux (tous)",
    "Opportunités qualifiées (≥10%)",
    "Funnel par taux",
  ];

  for (const heading of widgetHeadings) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

import { test, expect } from "@playwright/test";

/**
 * Authenticated, read-only. Covers the Lot 3 pieces that are actually
 * testable without writing anything: the mobile "..." menu's dismissal
 * behavior, and the shared ErrorBanner rendering with role="alert" for a
 * purely client-side validation error (NewDealModal never calls onCreate
 * for this case - no network write happens).
 *
 * WidgetInfoTooltip's click-only trigger is NOT covered here - tried it,
 * but /intelligence's own widget grid re-renders in the background (its
 * `loading` state and the live data it's built from), which intermittently
 * remounted the popover mid-test and reset its open state, independent of
 * anything this lot changed. Verified instead by reading the component
 * (unchanged open/onClick logic - only the popover's own shadow moved to
 * the shared POPOVER_CHROME) plus a successful typecheck/build.
 */
test("mobile menu closes on Escape and on outside click", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByTestId("deal-card").first().waitFor();

  const trigger = page.getByRole("button", { name: "Plus d'actions" });
  await trigger.click();
  await expect(page.getByRole("button", { name: "Rafraîchir" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Rafraîchir" })).toBeHidden();

  await trigger.click();
  await expect(page.getByRole("button", { name: "Rafraîchir" })).toBeVisible();
  await page.mouse.click(10, 500);
  await expect(page.getByRole("button", { name: "Rafraîchir" })).toBeHidden();
});

test("NewDealModal shows the shared error banner for a client-side validation error", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deal-card").first().waitFor();

  await page.getByRole("button", { name: "Nouveau client" }).click();
  // Prénom has the native `required` attribute, which blocks submission
  // (and this custom handler) entirely if left truly empty - a single
  // space passes that native check but still fails the component's own
  // `.trim()`-based one, reaching its early-return before onCreate is
  // ever called. No network write happens for this case either way.
  await page.locator(".max-w-2xl input[required]").fill(" ");
  await page.getByRole("button", { name: "Créer le client" }).click();

  // Not page.getByRole("alert") alone - Next.js's own router route-change
  // announcer (#__next-route-announcer__) also carries role="alert" on
  // every page and would be the first match. Filtering by this banner's
  // own text is what actually identifies ErrorBanner specifically.
  const banner = page.getByRole("alert").filter({ hasText: "Le prénom ou le nom est requis" });
  await expect(banner).toBeVisible();
});

import { test, expect } from "@playwright/test";

/**
 * Read-only by design: regenerate_my_calendar_token() (migration 0029)
 * would really replace qa-bot's calendar token in production, so this test
 * NEVER lets it run. Any request to that RPC is aborted at the network
 * layer before it leaves the browser and counted - the test fails if even
 * one was attempted. It only checks that the button exists and that the
 * confirmation opens and closes; Confirmer is never clicked.
 *
 * Never reads or prints the feed URL either - it contains qa-bot's real
 * token.
 */

test("Régénérer mon lien : le bouton et la confirmation s'affichent, sans jamais appeler la fonction", async ({ page }) => {
  let regenerateCalls = 0;
  await page.route("**/rest/v1/rpc/regenerate_my_calendar_token**", (route) => {
    regenerateCalls++;
    return route.abort();
  });

  await page.goto("/settings");

  const regenerate = page.getByRole("button", { name: "Régénérer mon lien" });
  await expect(regenerate).toBeVisible();
  await expect(regenerate).toBeEnabled();

  await regenerate.click();

  await expect(
    page.getByText(
      "L'ancien lien cessera de fonctionner. Il faudra supprimer l'ancien calendrier dans Outlook et t'abonner au nouveau lien."
    )
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer" })).toBeVisible();
  // Focus lands on Annuler, not Confirmer - an accidental Enter must not regenerate.
  const cancel = page.getByRole("button", { name: "Annuler" });
  await expect(cancel).toBeFocused();
  await expect(regenerate).toBeDisabled();

  await cancel.click();

  await expect(page.getByRole("button", { name: "Confirmer" })).toHaveCount(0);
  await expect(regenerate).toBeEnabled();
  expect(regenerateCalls).toBe(0);
});

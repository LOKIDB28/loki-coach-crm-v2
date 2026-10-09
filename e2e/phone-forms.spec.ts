import { test, expect, type Page } from "@playwright/test";

/**
 * Read-only by design, against production through qa-bot: every write to
 * the Supabase REST API (any non-GET/HEAD request) is intercepted, recorded
 * and ABORTED before it leaves the browser - nothing is ever created or
 * updated. The tests assert on what the app tried to send, not on the
 * database. Fictitious phone numbers only; no real contact data is read
 * back or printed.
 */

type Write = { method: string; path: string; body: Record<string, unknown> | null };

async function blockWrites(page: Page): Promise<Write[]> {
  const writes: Write[] = [];
  await page.route("**/rest/v1/**", (route) => {
    const req = route.request();
    if (req.method() === "GET" || req.method() === "HEAD") return route.continue();
    let body: Record<string, unknown> | null = null;
    try {
      const parsed = req.postDataJSON();
      body = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      body = null;
    }
    writes.push({ method: req.method(), path: new URL(req.url()).pathname, body });
    return route.abort();
  });
  return writes;
}

const field = (page: Page, label: string) => page.locator(`div:has(> label:text-is("${label}")) input`).first();

for (const [label, typed, expectedField, expectedSent] of [
  ["vide", "", "", null],
  ["invalide (format inconnu)", "Cell 418-805-56", "Cell 418-805-56", "Cell 418-805-56"],
  ["7 chiffres", "805-5602", "805-5602", "805-5602"],
  ["nord-américain", "(418) 805-5602", "+1-418-805-5602", "+1-418-805-5602"],
] as const) {
  test(`Nouveau client, téléphone ${label} : rien n'est bloqué, envoyé tel quel ou formaté`, async ({ page }) => {
    const writes = await blockWrites(page);
    await page.goto("/");
    // Dashboard data (pipeline stages included) must be loaded first -
    // creating before that fails with "Aucune étape de pipeline configurée."
    await page.getByRole("button", { name: "Vue grille" }).click();
    await expect(page.getByTestId("deal-card").first()).toBeVisible();
    await page.getByRole("button", { name: "Nouveau client" }).click();

    await field(page, "Prénom").fill("Fictif");
    await field(page, "Nom").fill("Test e2e");
    const phone = field(page, "Téléphone");
    await phone.fill(typed);
    await phone.blur();
    await expect(phone).toHaveValue(expectedField);

    await page.getByRole("button", { name: "Créer le client" }).click();

    // The insert was attempted (nothing blocked it client-side) - and aborted here.
    await expect.poll(() => writes.filter((w) => w.path.endsWith("/rest/v1/contacts")).length).toBe(1);
    const sent = writes.find((w) => w.path.endsWith("/rest/v1/contacts"))!;
    expect(sent.method).toBe("POST");
    expect(sent.body?.telephone).toBe(expectedSent);
  });
}

test("Tiroir : passer dans le champ Téléphone sans rien modifier n'envoie aucune requête", async ({ page }) => {
  const writes = await blockWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  const phone = field(page, "Téléphone");
  const before = writes.length;
  await phone.focus();
  await phone.blur();
  await page.waitForTimeout(1000);
  expect(writes.length - before).toBe(0);

  // Positive control - proves the probe does see a drawer write: an actual
  // change sends exactly one PATCH (aborted, so nothing is saved).
  await phone.fill("418 805 5602 x1");
  await phone.blur();
  await expect.poll(() => writes.length - before).toBe(1);
  const sent = writes[writes.length - 1]!;
  expect(sent.method).toBe("PATCH");
  expect(sent.path).toMatch(/\/rest\/v1\/contacts$/);
  expect(sent.body?.telephone).toBe("+1-418-805-5602 x1");
});

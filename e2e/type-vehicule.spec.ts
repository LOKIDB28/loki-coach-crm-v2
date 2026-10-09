import { test, expect, type Page } from "@playwright/test";
import {
  getTypeFilterCounts,
  LEGACY_TYPE_VEHICULE,
  matchesTypeFilter,
  TYPE_FILTERS,
  TYPE_VEHICULE_OPTIONS,
  typeVehiculeInfo,
} from "../src/lib/domain";
import { neutralizeCsvFormula } from "../src/lib/csv";

/**
 * Vehicle type (deals.type_vehicule_vise): pure checks on fictitious values,
 * then read-only browser checks against production through qa-bot - every
 * write to the Supabase REST API is intercepted and ABORTED before it
 * leaves the browser, and the tests fail if one was even attempted. Never
 * prints real client data; only counts are compared.
 */

async function blockWrites(page: Page): Promise<string[]> {
  const writes: string[] = [];
  await page.route("**/rest/v1/**", (route) => {
    const req = route.request();
    if (req.method() === "GET" || req.method() === "HEAD") return route.continue();
    writes.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.abort();
  });
  return writes;
}

test("type de véhicule : libellés, groupes et anciennes valeurs", () => {
  const expected: [value: string | null, label: string | null, group: string | null][] = [
    ["neuf_bath_half", "Neuf-Bath/Half", "neuf"],
    ["neuf_bunk", "Neuf-Bunk", "neuf"],
    ["used", "Used", "used"],
    ["entertainer_star_coach", "Entertainer - Star Coach", "entertainer"],
    ["entertainer_bunk", "Entertainer - Bunk", "entertainer"],
    ["vehicle_special", "Vehicle Special", "special"],
    ["neuf", "Neuf (ancien, à préciser)", "neuf"],
    ["usager", "Used (ancien « usager »)", "used"],
    ["valeur_inconnue", "valeur_inconnue", null],
    [null, null, null],
    ["", null, null],
  ];
  for (const [value, label, group] of expected) {
    const info = typeVehiculeInfo(value);
    expect(info?.label ?? null, String(value)).toBe(label);
    expect(info?.group ?? null, String(value)).toBe(group);
  }
  expect(typeVehiculeInfo("neuf")?.legacy).toBe(true);
  expect(typeVehiculeInfo("usager")?.legacy).toBe(true);
  expect(typeVehiculeInfo("used")?.legacy).toBe(false);
});

test("filtre Type : chaque valeur tombe dans le bon groupe, anciennes valeurs comprises", () => {
  const cases: [value: string | null, bucket: string | null][] = [
    ["neuf_bath_half", "neuf"],
    ["neuf_bunk", "neuf"],
    ["neuf", "neuf"],
    ["used", "used"],
    ["usager", "used"],
    ["entertainer_star_coach", "entertainer"],
    ["entertainer_bunk", "entertainer"],
    ["vehicle_special", "special"],
    [null, "none"],
    ["", "none"],
    ["valeur_inconnue", null], // only under "Tous"
  ];
  for (const [value, bucket] of cases) {
    for (const f of TYPE_FILTERS) expect(matchesTypeFilter(value, f.key), `${value} / ${f.key}`).toBe(f.key === bucket);
    expect(matchesTypeFilter(value, null), `${value} / Tous`).toBe(true);
  }
  const counts = getTypeFilterCounts(cases.map(([type_vehicule_vise]) => ({ type_vehicule_vise })));
  expect(counts).toEqual({ neuf: 3, used: 2, entertainer: 2, special: 1, none: 2 });
});

test("export CSV : colonne Type = libellé affiché, protégée contre les formules", () => {
  for (const o of [...TYPE_VEHICULE_OPTIONS, ...LEGACY_TYPE_VEHICULE]) {
    const cell = neutralizeCsvFormula(typeVehiculeInfo(o.value)?.label ?? "");
    expect(cell).toBe(o.label);
    expect(cell).not.toMatch(/^[=+\-@\t\r]/);
  }
  expect(neutralizeCsvFormula(typeVehiculeInfo("=1+1")?.label ?? "")).toBe("'=1+1");
  expect(neutralizeCsvFormula(typeVehiculeInfo(null)?.label ?? "")).toBe("");
});

test("filtre Type (lecture seule) : chaque option montre autant de fiches que son compteur, la pastille le retire", async ({
  page,
}) => {
  const writes = await blockWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await expect(page.getByTestId("deal-card").first()).toBeVisible();
  const total = await page.getByTestId("deal-card").count();

  const typeButton = page.getByRole("button", { name: "Type", exact: true });
  for (const f of TYPE_FILTERS) {
    // Each round ends with the filter cleared, so the button reads "Type" again.
    await typeButton.click();
    await expect(page.getByRole("option", { name: "Tous" })).toBeVisible();
    const count = Number(await page.getByTestId(`type-count-${f.key}`).innerText());
    await page.getByRole("option", { name: new RegExp(`^${f.label}`) }).click();

    await expect(page.getByText(`Type: ${f.label}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId("deal-card")).toHaveCount(count);

    await page.getByText(`Type: ${f.label}`, { exact: true }).getByLabel("Retirer le filtre").click();
    await expect(page.getByText(`Type: ${f.label}`, { exact: true })).toBeHidden();
    await expect(page.getByTestId("deal-card")).toHaveCount(total);
  }
  expect(writes).toEqual([]);
});

test("tiroir (lecture seule) : « Véhicule en échange ? » visible pour chaque type, cachée seulement sans type", async ({
  page,
}) => {
  const writes = await blockWrites(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  const typeSelect = page.locator('div:has(> label:text-is("Type de véhicule visé")) select').first();
  const echange = page.getByRole("checkbox", { name: "Véhicule en échange ?" });

  // Local draft only - section 1 saves on its own button, never clicked here.
  for (const o of TYPE_VEHICULE_OPTIONS) {
    await typeSelect.selectOption(o.value);
    await expect(echange, o.value).toBeVisible();
  }
  await typeSelect.selectOption("");
  await expect(echange).toBeHidden();

  expect(writes).toEqual([]);
});

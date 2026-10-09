import { test, expect, type Page } from "@playwright/test";
import { hasUpcomingCalendarDate } from "../src/lib/calendar";

/**
 * Outlook guard-rail in the deal drawer. Pure checks on fictitious dates,
 * then a read-only browser check against production through qa-bot: every
 * write to the Supabase REST API is intercepted and ABORTED before it leaves
 * the browser (changing the representative autosaves - those PATCHes are
 * recorded and never sent). Only drafts and local state change; no client
 * data is printed.
 */

test("hasUpcomingCalendarDate : aujourd'hui ou à venir seulement, date seule comprise", () => {
  const now = new Date(2026, 9, 9, 15, 30); // 9 oct. 2026, 15 h 30, heure locale
  const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();

  expect(hasUpcomingCalendarDate({}, now)).toBe(false);
  expect(hasUpcomingCalendarDate({ date_essai_routier: at(2026, 9, 10, 9) }, now)).toBe(true); // demain
  expect(hasUpcomingCalendarDate({ date_visite_usine: at(2026, 9, 9, 8) }, now)).toBe(true); // ce matin = aujourd'hui
  expect(hasUpcomingCalendarDate({ next_action_at: at(2026, 9, 8, 23, 59) }, now)).toBe(false); // hier soir
  expect(hasUpcomingCalendarDate({ date_rdv_service: "2026-10-09" }, now)).toBe(true); // aujourd'hui, journée entière
  expect(hasUpcomingCalendarDate({ date_rdv_service: "2026-10-08" }, now)).toBe(false);
  expect(hasUpcomingCalendarDate({ date_visite_bureau: at(2025, 0, 1), date_essai_routier: at(2027, 0, 1) }, now)).toBe(true);
  expect(hasUpcomingCalendarDate({ date_visite_bureau: null, date_essai_routier: "pas une date" }, now)).toBe(false);
});

async function openSection(page: Page, code: number) {
  const header = page.getByRole("button", { name: new RegExp(`^${code} · `) });
  const collapsed = await header
    .locator("xpath=following-sibling::div[1]")
    .evaluate((el) => el.className.includes("grid-rows-[0fr]"));
  if (collapsed) await header.click();
}

const field = (page: Page, label: string, tag: "input" | "select" = "input") =>
  page.locator(`div:has(> label:text-is("${label}")) ${tag}`).first();

test("tiroir (lecture seule) : note « Sans représentant » avec une date future, retirée avec un représentant ou une date passée", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const writes: { method: string; path: string; keys: string[] }[] = [];
  await page.route("**/rest/v1/**", (route) => {
    const req = route.request();
    if (req.method() === "GET" || req.method() === "HEAD") return route.continue();
    let keys: string[] = [];
    try {
      keys = Object.keys(req.postDataJSON() ?? {});
    } catch {
      keys = [];
    }
    writes.push({ method: req.method(), path: new URL(req.url()).pathname, keys });
    return route.abort();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();
  await openSection(page, 3);
  await openSection(page, 6);

  const note = page.getByText("Sans représentant, ce rendez-vous n'apparaîtra dans aucun calendrier Outlook.");
  const owner = field(page, "Représentant", "select");
  const essai = field(page, "Date essai routier");

  // Start from a known state: no representative, no feed date (drafts only).
  await owner.selectOption("");
  for (const label of ["Date de suivi", "Date visite d'usine (accès sécurisé)", "Date visite au bureau", "Date essai routier"]) {
    await field(page, label).fill("");
  }
  await field(page, "Date du 1er rendez-vous service").fill("");
  await expect(note).toBeHidden();

  // A future date typed (not saved) → the note appears, as status text.
  await essai.fill("2099-06-15T10:00");
  await expect(note).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Sans représentant" })).toBeVisible();

  // A representative chosen → gone.
  await owner.selectOption({ index: 1 });
  await expect(note).toBeHidden();

  // Back to no representative → back.
  await owner.selectOption("");
  await expect(note).toBeVisible();

  // The date moved to the past → gone.
  await essai.fill("2020-06-15T10:00");
  await expect(note).toBeHidden();

  // Only the representative autosaves were attempted - all aborted, nothing saved.
  for (const w of writes) {
    expect(w.method).toBe("PATCH");
    expect(w.path).toMatch(/\/rest\/v1\/deals$/);
    expect(w.keys).toEqual(["owner_id"]);
  }
  expect(pageErrors).toEqual([]);
});

test("tiroir : les icônes Outlook ont un nom accessible et ne sont pas des boutons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Vue grille" }).click();
  await page.getByTestId("deal-card").first().click();
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();

  await expect(page.getByRole("img", { name: "Va dans le calendrier Outlook" })).toHaveCount(4);
  await expect(page.getByRole("img", { name: "Va dans Outlook, journée entière" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Outlook/ })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Va dans le calendrier Outlook" }).first()).toHaveAttribute(
    "title",
    "Va dans le calendrier Outlook"
  );
});

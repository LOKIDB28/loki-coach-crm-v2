import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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

/**
 * Ground-truth pattern (same as dashboard.spec.ts's deal-count check) -
 * not fictional data: this suite has no mocking layer, every spec here
 * runs against the real qa-bot session per playwright.config.ts's own
 * design ("there is no separate test environment or database"). A
 * fabricated in-memory fixture would need either a second test harness or
 * a real write to production to set up - both out of scope for a small
 * read-only check.
 *
 * The source value to search for is picked AT RUN TIME, not hardcoded:
 * whichever real contacts.source value currently has exactly one
 * non-archived deal attached to it (grouped the same normalized way as
 * getDistinctSourcesWithCounts/matchesSourceFilter in lib/domain.ts, so a
 * case/accent/whitespace variant of the same source doesn't look rare when
 * it isn't). A rare value is unlikely to also be a substring of some other
 * contact's name/email/phone, which is what would make a match prove
 * nothing about source specifically - but this is a real-world property of
 * whatever the team's data looks like today, not something this test can
 * guarantee for an arbitrary future value; a coincidental collision would
 * surface as a genuine (if unrelated) failure here, not a false pass.
 */
test("search text finds a dossier by its source", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("id, contacts(source)")
    .eq("archived", false)
    .returns<{ id: string; contacts: { source: string | null } | null }[]>();
  if (error) throw error;

  function normalizeSourceKey(s: string): string {
    return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");
  }

  const bySource = new Map<string, { label: string; count: number }>();
  for (const d of data) {
    const source = d.contacts?.source;
    if (!source || !source.trim()) continue;
    const key = normalizeSourceKey(source);
    const existing = bySource.get(key);
    if (existing) existing.count++;
    else bySource.set(key, { label: source, count: 1 });
  }

  const rare = [...bySource.values()].find((v) => v.count === 1);
  if (!rare) {
    throw new Error("No contacts.source value has exactly one non-archived deal right now - can't pick a rare value to search for.");
  }

  await page.goto("/");
  await page.getByTestId("deal-card").first().waitFor();

  await page.getByPlaceholder("Rechercher (nom, courriel, téléphone, source)").fill(rare.label);
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
});

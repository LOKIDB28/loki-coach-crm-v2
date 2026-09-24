import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Authenticated (qa-bot storageState, see scripts/e2e-auth-setup.ts).
 * Read-only against loki-crm-prod - the deal count is never hardcoded,
 * it's read fresh from the database via a service-role client (bypasses
 * RLS for a trustworthy baseline; this key is only ever used here,
 * server-side in the test process, never sent to the browser Playwright
 * drives) and compared against what actually renders.
 */

test("authenticated session loads the dashboard, not the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Nouveau client" })).toBeVisible();
});

test("pipeline grid shows the real number of non-archived deals", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await supabaseAdmin.from("deals").select("id", { count: "exact", head: true }).eq("archived", false);
  if (error) throw error;
  if (count === null) throw new Error("Ground-truth deal count query returned null.");

  await page.goto("/");
  // Force grid layout explicitly rather than assuming the qa-bot's default
  // (kanban renders different card markup without the deal-card test id) -
  // makes this deterministic regardless of layout defaults/preferences.
  await page.getByRole("button", { name: "Vue grille" }).click();

  await expect(page.getByTestId("deal-card")).toHaveCount(count);
});

/**
 * Generates a real Supabase session for the qa-bot profile (see
 * scripts/e2e-create-qa-bot.ts - run that first, once) and saves it as a
 * Playwright storageState file. Run manually whenever the cached session
 * expires or is missing - never regenerated automatically before every
 * test run.
 *
 * Usage: npx tsx scripts/e2e-auth-setup.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * PLAYWRIGHT_TEST_EMAIL in .env.local. The service role key is used only
 * here, server-side, to call the Supabase admin API - it is never sent to
 * or used by the browser Playwright drives; the browser only ever sees a
 * one-time magic-link token_hash and the resulting session cookies.
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? "http://localhost:3000";
const STORAGE_STATE_PATH = "playwright/.auth/storageState.json";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
}
if (!testEmail) {
  throw new Error("Missing PLAYWRIGHT_TEST_EMAIL in the environment (.env.local).");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // See src/app/auth/callback/route.ts for why this uses token_hash +
  // verifyOtp rather than following action_link's own PKCE redirect - an
  // admin-generated link is opened by a browser that never called
  // signInWithOtp itself, so no code_verifier exists anywhere.
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    // Non-null: already validated above (throws otherwise) - TS narrowing
    // on a module-scope const doesn't carry into this nested function.
    email: testEmail!,
  });
  if (error || !data?.properties?.hashed_token) {
    throw error ?? new Error("generateLink returned no hashed_token.");
  }

  const callbackUrl = `${appUrl}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink`;

  console.log(`Requires "npm run dev" to already be running at ${appUrl} (webServer only auto-starts inside "npx playwright test").`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(callbackUrl);
  // Confirms the session actually landed on the dashboard, not a bounce
  // back to /login?error=... - fails loudly instead of silently saving an
  // unauthenticated storageState that would make every "authenticated"
  // test look broken for the wrong reason.
  await page.waitForSelector('[aria-label="Nouveau client"]', { timeout: 15_000 });

  await mkdir("playwright/.auth", { recursive: true });
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();

  console.log(`Session saved to ${STORAGE_STATE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

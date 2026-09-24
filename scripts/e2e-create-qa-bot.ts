/**
 * One-time setup: creates a dedicated qa-bot profile (role: internal) for
 * Playwright e2e tests, so automated test sessions never reuse a real
 * human's account - keeps test activity clearly separate from real human
 * activity in activities/audit trails. Safe to re-run: does nothing if a
 * profile with this email already exists.
 *
 * Usage: npx tsx scripts/e2e-create-qa-bot.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * PLAYWRIGHT_TEST_EMAIL in .env.local (loaded automatically). The service
 * role key bypasses RLS to create an auth.users row directly via the
 * admin API - never expose it to a browser or commit it.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
}
if (!testEmail) {
  throw new Error(
    "Missing PLAYWRIGHT_TEST_EMAIL in the environment (.env.local) - the dedicated qa-bot profile email to create."
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existingProfile, error: lookupError } = await supabaseAdmin
    .from("profiles")
    .select("id, nom, email, role")
    .eq("email", testEmail)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existingProfile) {
    console.log(`Profile already exists: ${existingProfile.email} (role: ${existingProfile.role}, id: ${existingProfile.id})`);
    if (existingProfile.role !== "internal") {
      console.warn(
        `Warning: existing role is "${existingProfile.role}", not "internal" as requested - not changing it automatically, update it yourself if that's wrong.`
      );
    }
    return;
  }

  // email_confirm: true - the user is created already confirmed, no
  // confirmation email sent for a bot account nobody reads.
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
    user_metadata: { created_by: "scripts/e2e-create-qa-bot.ts" },
  });
  if (createError || !created.user) {
    throw createError ?? new Error("createUser returned no user.");
  }
  console.log(`Auth user created: ${created.user.id}`);

  // loki-crm-prod's on_auth_user_created trigger creates the matching
  // profiles row with role='internal' by default (confirmed in README) -
  // a short wait + verification here rather than assuming the trigger has
  // already run by the time this script reads it back.
  await new Promise((r) => setTimeout(r, 1500));

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, nom, email, role")
    .eq("id", created.user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    throw new Error(
      "Auth user created, but no matching profiles row appeared - the on_auth_user_created trigger may not have fired. Check it exists: select tgname from pg_trigger where tgname = 'on_auth_user_created'."
    );
  }

  if (profile.role !== "internal") {
    console.log(`Trigger set role="${profile.role}" - correcting to "internal" as requested.`);
    const { error: updateError } = await supabaseAdmin.from("profiles").update({ role: "internal" }).eq("id", profile.id);
    if (updateError) throw updateError;
  }

  console.log(`qa-bot profile ready: ${testEmail} (id: ${profile.id}, role: internal)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

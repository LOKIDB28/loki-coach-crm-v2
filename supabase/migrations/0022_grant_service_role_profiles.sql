-- LOKI Coach CRM v2 - documents a GRANT that was missing since the
-- project's origin, discovered today while wiring up Playwright e2e
-- testing (scripts/e2e-create-qa-bot.ts, scripts/e2e-auth-setup.ts): the
-- service_role key had no explicit select/insert/update grant on
-- public.profiles. Likely an oversight in
-- 0004_grant_authenticated_privileges.sql, which covered authenticated,
-- retool_app, and claude_code_ro on various tables but never service_role
-- on this one specifically.
--
-- This is NOT a new change - the grant was already applied by hand in
-- prod today to unblock the e2e work, verified working before this file
-- was written. This migration only makes that existing state reproducible
-- and versioned, per the project's rule that every SQL change - including
-- one applied manually in a hurry - ends up in a migration file.
--
-- GRANT is naturally idempotent in Postgres (no "IF NOT EXISTS" syntax
-- exists for it, none is needed) - re-running this against a database
-- that already has the grant is a safe no-op, not an error.

grant select, insert, update on public.profiles to service_role;

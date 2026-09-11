-- LOKI Coach CRM v2 - grant base table privileges to `authenticated`
--
-- Root cause of "Erreur de chargement." / every list showing 0 rows for a
-- real signed-in user: loki-crm-prod's RLS policies (is_internal(), etc.)
-- were created scoped `to authenticated`, but the underlying GRANT
-- statements for that role were never run. Postgres checks table-level
-- privileges BEFORE evaluating row-level security - without the GRANT, a
-- signed-in user gets a hard `42501 permission denied for table X` on
-- every query, not merely an RLS-empty result. Confirmed via
-- information_schema.role_table_grants: no grantee other than a read-only
-- reporting role held any privilege on any public table.
--
-- Policy names/commands below confirmed via
-- `select tablename, policyname, cmd from pg_policies where schemaname =
-- 'public'` against loki-crm-prod (not assumed from the scaffold's own
-- 0001_init.sql, which used different policy names and did not match).
--
-- No DELETE is granted anywhere, on any table, even where the underlying
-- policy is FOR ALL - project rule: no physical deletion of contacts,
-- deals, or tasks anywhere in the app, archiving only (contacts.archived).
-- A GRANT narrower than its policy is safe (the policy would still permit
-- it; the GRANT is simply the tighter of the two) - this intentionally
-- makes hard deletes impossible at the database level, not just in app code.

-- profiles: "interne lit profils" (SELECT, all internal users) + "modifie
-- son profil" (UPDATE, own row only). No INSERT policy exists - the
-- profiles row is created by the on_auth_user_created trigger, which runs
-- SECURITY DEFINER and bypasses RLS/grants entirely.
grant select, update on public.profiles to authenticated;

-- contacts, deals, coaches: single "interne tout X" ALL-command policy
-- each - granted select/insert/update only, per the no-delete rule above.
grant select, insert, update on public.contacts to authenticated;
grant select, insert, update on public.deals to authenticated;
grant select, insert, update on public.coaches to authenticated;

-- activities: append-only by design - "interne ajoute activites" (INSERT)
-- + "interne lit activites" (SELECT). No update/delete policy either.
grant select, insert on public.activities to authenticated;

-- pipeline_stages: "interne lit stages" - SELECT only.
grant select on public.pipeline_stages to authenticated;

-- tasks, staging_import: not queried by this app yet, but each already has
-- an ALL-command "interne tout X" / "interne staging" policy - granted
-- select/insert/update (no delete, same rule) for consistency so the same
-- class of bug doesn't resurface if/when either is wired up.
grant select, insert, update on public.tasks to authenticated;
grant select, insert, update on public.staging_import to authenticated;

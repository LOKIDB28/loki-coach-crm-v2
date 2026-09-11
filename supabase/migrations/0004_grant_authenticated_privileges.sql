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
-- Each GRANT below matches exactly the verbs already implied by that
-- table's existing RLS policies - no new access is being introduced,
-- this only makes the previously-written policies actually reachable.

-- profiles: select all, insert/update own (see profiles_select_all,
-- profiles_insert_own, profiles_update_own) - no delete policy exists.
grant select, insert, update on public.profiles to authenticated;

-- contacts, deals, coaches: single "interne tout X" ALL-command policy each.
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.coaches to authenticated;

-- activities: append-only by design - select + insert policies only, no
-- update/delete policy, so no update/delete grant either.
grant select, insert on public.activities to authenticated;

-- pipeline_stages: select-only policy ("interne lit stages").
grant select on public.pipeline_stages to authenticated;

-- tasks, staging_import: not queried by this app yet, but each already has
-- an ALL-command "interne tout X" policy - granted for consistency so the
-- same class of bug doesn't resurface if/when either is wired up.
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.staging_import to authenticated;

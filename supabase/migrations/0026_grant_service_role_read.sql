-- LOKI Coach CRM v2 - service_role had no read grant at all on
-- public.deals/contacts/activities/pipeline_stages. Only public.profiles
-- had been corrected for this key (0022_grant_service_role_profiles.sql) -
-- these four were missed, same likely origin (an oversight in
-- 0004_grant_authenticated_privileges.sql, which never covered
-- service_role on them). Discovered when e2e/dashboard.spec.ts's
-- ground-truth deal count (a service-role query, bypassing RLS for a
-- trustworthy baseline) failed with "permission denied for table deals".
--
-- Deliberately read-only for this key: no insert/update/delete grant on
-- any of these four, matching how service_role is actually used today
-- (e2e read-only baselines, admin-API calls that don't touch these tables
-- directly) - a future write need here should get its own explicit grant
-- and its own sign-off, not silently ride along with this one.
--
-- GRANT is naturally idempotent in Postgres (no "IF NOT EXISTS" syntax
-- exists for it, none is needed) - re-running this against a database
-- that already has the grant is a safe no-op, not an error.

grant select on public.deals, public.contacts, public.activities, public.pipeline_stages to service_role;

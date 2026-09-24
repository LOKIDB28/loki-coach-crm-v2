-- LOKI Coach CRM v2 - fixes for two Supabase Security Advisor findings.
-- Both objects predate this app (v_sources/v_forecast_par_rep: "already
-- existed in loki-crm-prod" per 0006; staging_pipedrive: created here in
-- 0009 but never given a policy) - neither was ever authored with these
-- properties by us, this migration only corrects them.

-- =========================================================================
-- 1. ERROR - v_sources / v_forecast_par_rep run as SECURITY DEFINER views
--    (the default when a view's security_invoker option is never set),
--    silently bypassing RLS on deals/pipeline_stages/contacts/profiles for
--    whoever queries them. Recreated with security_invoker = true (the
--    RLS-respecting behavior) - query body copied verbatim from
--    pg_get_viewdef(), confirmed against the live definitions before
--    writing this, nothing else changed. `create or replace view` cannot
--    add this option to an existing view, hence the explicit drop first.
--    Re-grants select to authenticated since dropping a view drops its
--    grants too (0006_grant_reporting_views.sql originally added this).
-- =========================================================================

drop view if exists public.v_sources;

create view public.v_sources
with (security_invoker = true)
as
SELECT COALESCE(d.source, 'Inconnue'::text) AS source,
    count(*) AS nb_deals,
    count(*) FILTER (WHERE s.code = 'gagne'::text) AS gagnes,
    COALESCE(sum(d.montant) FILTER (WHERE s.code = 'gagne'::text), 0::numeric) AS revenus
   FROM deals d
     JOIN pipeline_stages s ON s.id = d.stage_id
  GROUP BY d.source
  ORDER BY (count(*)) DESC;

grant select on public.v_sources to authenticated;

drop view if exists public.v_forecast_par_rep;

create view public.v_forecast_par_rep
with (security_invoker = true)
as
SELECT COALESCE(p.nom, 'Non assigné'::text) AS proprietaire,
    count(d.id) AS nb_deals,
    COALESCE(sum(d.montant), 0::numeric) AS valeur_brute,
    COALESCE(sum(d.montant * s.probability), 0::numeric) AS valeur_ponderee
   FROM deals d
     JOIN pipeline_stages s ON s.id = d.stage_id AND s.is_open
     LEFT JOIN profiles p ON p.id = d.owner_id
  GROUP BY p.nom
  ORDER BY (COALESCE(sum(d.montant * s.probability), 0::numeric)) DESC;

grant select on public.v_forecast_par_rep to authenticated;

-- =========================================================================
-- 2. INFO - staging_pipedrive has RLS enabled (relrowsecurity = true,
--    confirmed) with zero policies, so it's fully unreadable right now,
--    even internally. Same pattern as staging_import's existing "interne
--    staging" policy (ALL command, is_internal() for both using and with
--    check) rather than leaving it locked - a one-time Pipedrive-import
--    staging table someone may want to consult later.
-- =========================================================================

create policy "interne staging" on public.staging_pipedrive
  for all
  using (public.is_internal())
  with check (public.is_internal());

-- Same select/insert/update (no delete) grant staging_import already has -
-- see 0004_grant_authenticated_privileges.sql's no-physical-deletion rule.
-- A GRANT narrower than the policy is safe and intentional, not a mismatch.
grant select, insert, update on public.staging_pipedrive to authenticated;

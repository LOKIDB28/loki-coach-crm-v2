-- LOKI Coach CRM v2 - grant SELECT on reporting views to `authenticated`
--
-- Same class of bug as 0004: authenticated already has TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN on these two views (from some earlier default grant),
-- but not SELECT - confirmed via has_table_privilege('authenticated',
-- 'public.v_sources'/'public.v_forecast_par_rep', 'SELECT') both returning
-- false. Querying either view from the app would fail with the same
-- `42501 permission denied` error 0004 fixed for the base tables.
--
-- Powers LOKI Intelligence's source breakdown and weighted forecast. Both
-- views already existed in loki-crm-prod before this app was connected to
-- it - this migration only adds the missing read grant, nothing else.

grant select on public.v_sources to authenticated;
grant select on public.v_forecast_par_rep to authenticated;

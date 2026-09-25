-- LOKI Coach CRM v2 - role swap: Louis-Philippe becomes assignable as a
-- deal's Représentant again, Marie-Pierre is excluded the same way Erick
-- already is.
--
-- Supersedes the assignable_as_rep column plan (see the now-abandoned
-- 0024_add_profiles_assignable_as_rep.sql draft, never applied to
-- loki-crm-prod): that approach is unnecessary because the existing
-- `role !== 'admin'` filter in NewDealModal/DealDrawer (the two
-- assignment selectors) already produces the right result once role
-- itself reflects who should be assignable. No new column, no new app
-- code.
--
-- Confirmed before writing this: `is_internal()` (the RLS gate on
-- contacts/deals/activities/staging_pipedrive/exchange_rates/deal-photos)
-- treats role='admin' and role='internal' identically - only role='client'
-- is excluded. So this swap changes zero database access for either
-- person; it only changes which rep-selection UI lists include them
-- (NewDealModal, DealDrawer's owner-reassignment selector, and
-- RepresentativeTabs via role='internal').

update public.profiles set role = 'internal' where email = 'louis-philippe.deblois@lokicoach.com';
update public.profiles set role = 'admin' where email = 'marie-pierre.boutin@lokicoach.com';

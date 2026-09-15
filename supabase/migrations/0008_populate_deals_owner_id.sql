-- LOKI Coach CRM v2 - populate deals.owner_id from staging_import.responsible
--
-- owner_id already exists on deals (original prod column) - purely a
-- one-time backfill, no schema change. Matching mechanism is the exact one
-- verified and used for 0007 (rate_percent): staging_import has no stored
-- contact_id, so each row is matched to a contact by email first
-- (case-insensitive, trimmed), falling back to phone (digits-only
-- comparison) when email is blank or doesn't match.
--
-- Audited before writing this (7 distinct staging_import.responsible
-- values, 369 rows total). Only two map to a known internal profile with
-- certainty:
--   "Pm" (165 rows) / "PM" (40 rows) - same person, casing varies in the
--     source Excel - no lowercase "pm" actually occurs -> pm@lokicoach.com
--   "Jeff" (58 rows) -> jeff@lokicoach.com
-- Everything else is deliberately left untouched (owner_id stays null):
--   "TMCS" (43 rows) - external distributor, not an internal rep (verified:
--     all 47 deals matched from these rows already have canal = 'tmcs')
--   "Pierre" (2 rows), "Samuel" (1 row) - no matching internal profile,
--     identity not confirmed - not guessed
--   NULL (60 rows) - old/inactive leads, intentionally not reassigned
--
-- Also verified before writing: no contact is reached by both a "pm" row
-- and a "jeff" row (no conflicting assignment), and none of the deals this
-- would update already has a non-null owner_id (the one deal that does -
-- an unrelated test entry - isn't linked to any of these staging rows).
-- "d.owner_id is null" is still kept below as a defensive guard against
-- overwriting any manual assignment.

with staging_matched as (
  select
    s.xl_id,
    lower(trim(s.responsible)) as responsible_norm,
    coalesce(
      (
        select c.id from public.contacts c
        where s.email is not null and trim(s.email) <> ''
          and lower(trim(c.email)) = lower(trim(s.email))
        limit 1
      ),
      (
        select c.id from public.contacts c
        where s.phone is not null and trim(s.phone) <> ''
          and regexp_replace(c.telephone, '[^0-9]', '', 'g') = regexp_replace(s.phone, '[^0-9]', '', 'g')
          and regexp_replace(s.phone, '[^0-9]', '', 'g') <> ''
        limit 1
      )
    ) as contact_id
  from public.staging_import s
  where lower(trim(s.responsible)) in ('pm', 'jeff')
)
update public.deals d
set owner_id = case sm.responsible_norm
  when 'pm' then (select id from public.profiles where email = 'pm@lokicoach.com')
  when 'jeff' then (select id from public.profiles where email = 'jeff@lokicoach.com')
end
from staging_matched sm
where d.contact_id = sm.contact_id
  and sm.contact_id is not null
  and d.owner_id is null;

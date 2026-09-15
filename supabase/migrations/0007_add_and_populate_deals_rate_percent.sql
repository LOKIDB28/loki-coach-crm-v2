-- LOKI Coach CRM v2 - add and backfill deals.rate_percent
--
-- Independent, complementary field - NOT a replacement for stage_id or
-- pipeline_stages (untouched here, per instruction). Purely additive
-- column, then a one-time backfill from staging_import.rate (present
-- since the initial import, never migrated).
--
-- Matching mechanism (verified against real data before writing this,
-- not assumed): staging_import has no stored contact_id/deal_id, so each
-- row is matched to a contact primarily by email (case-insensitive,
-- trimmed - 329/369 rows matched this way), falling back to phone
-- (digits-only comparison) when email is blank or doesn't match (recovers
-- ~19 more). Where email-match and name-match were cross-checked, they
-- agreed on 328 of 329 rows - high confidence in this approach. Rows with
-- no match on either, or whose staging_import.rate is blank (235/369),
-- are left untouched (rate_percent stays null) - no guessing.
--
-- staging_import.rate is a clean "N%" string or blank for every one of its
-- 369 rows (verified: 1%, 5%, 0%, 8%, 10%, 20%, 95%, 15%, 35%, 99%, or
-- empty - no other formats), so the strip-% + cast is safe.

alter table public.deals
  add column if not exists rate_percent numeric;

comment on column public.deals.rate_percent is
  'Backfilled once from staging_import.rate (raw Excel import). Independent of stage_id/pipeline_stages - not a probability override, just the imported rate value as a plain number (e.g. 35% -> 35).';

with staging_matched as (
  select
    s.xl_id,
    trim(trailing '%' from trim(s.rate))::numeric as rate_value,
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
  where s.rate is not null and trim(s.rate) <> ''
)
update public.deals d
set rate_percent = sm.rate_value
from staging_matched sm
where d.contact_id = sm.contact_id
  and sm.contact_id is not null;

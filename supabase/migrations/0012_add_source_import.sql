-- LOKI Coach CRM v2 - Phase 01: provenance marker for the 63 Pipedrive
-- deals/contacts imported by 0010, so DealCard/DealDrawer can show a
-- distinct badge for them. Purely additive.

alter table public.contacts
  add column if not exists source_import text;

alter table public.deals
  add column if not exists source_import text;

comment on column public.deals.source_import is
  'Provenance marker, e.g. ''pipedrive'' for the 63 deals from migration 0010 - not the same as deals.source (marketing/acquisition channel).';

comment on column public.contacts.source_import is
  'Provenance marker, e.g. ''pipedrive'' for the 63 contacts from migration 0010.';

-- Backfill: identifies the 63 rows created by 0010. No tracking column
-- existed at the time, so the correlation key is the exact transaction
-- timestamp - 0010 ran as a single DO block, and Postgres evaluates now()
-- once per transaction, so all 63 contacts and all 63 deals it created
-- share one identical, otherwise-unique timestamp. Verified before writing
-- this (not assumed): 'select created_at, count(*) from deals group by 1'
-- shows exactly 63 deals at 2026-09-17 13:42:26.843661+00, joining to
-- exactly 63 distinct contacts which themselves share that same instant -
-- clean 1:1, no collision with any other row. (A join on deals.titre =
-- staging_pipedrive.title was tried first and rejected: several titles
-- collide with unrelated pre-existing deals or with the internal
-- Jean-Louis Bellemare duplicate, which would have mis-tagged rows.)

do $$
declare
  v_ts timestamptz := '2026-09-17 13:42:26.843661+00';
  v_deal_count int;
  v_contact_count int;
begin
  select count(*) into v_deal_count from public.deals where created_at = v_ts;
  if v_deal_count <> 63 then
    raise exception 'Expected exactly 63 deals at %, found %', v_ts, v_deal_count;
  end if;

  select count(*) into v_contact_count
  from public.contacts
  where id in (select contact_id from public.deals where created_at = v_ts);
  if v_contact_count <> 63 then
    raise exception 'Expected exactly 63 contacts linked to the % deals, found %', v_ts, v_contact_count;
  end if;

  update public.deals set source_import = 'pipedrive' where created_at = v_ts;

  update public.contacts set source_import = 'pipedrive'
  where id in (select contact_id from public.deals where created_at = v_ts);
end $$;

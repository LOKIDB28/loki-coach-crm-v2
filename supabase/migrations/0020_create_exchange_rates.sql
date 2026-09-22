-- LOKI Coach CRM v2 - shared, manually-editable USD->CAD exchange rate for
-- LOKI Intelligence's CAD/USD display toggle. Replaces a hardcoded rate
-- (the 1.39 documented for the one-time Pipedrive import, README
-- "Conversions de devises appliquées" / 0010_import_pipedrive_deals.sql)
-- with a single shared value any internal rep can update, so the CRM
-- doesn't silently drift out of date years from now. Additive only.
--
-- Deliberately one row, not a history table: "updating the rate" always
-- means UPDATE-ing this row in place, confirmed in conversation - not
-- something the app inserts a new row for. No INSERT/DELETE grant below
-- enforces that at the DB level, not just by app convention.
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  usd_to_cad numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.exchange_rates enable row level security;

-- Same is_internal() gate as every other "interne" table - any admin/
-- internal rep can both read and update the shared rate, not just view it.
create policy "interne lit exchange_rates" on public.exchange_rates
  for select
  using (public.is_internal());

create policy "interne modifie exchange_rates" on public.exchange_rates
  for update
  using (public.is_internal())
  with check (public.is_internal());

grant select, update on public.exchange_rates to authenticated;
-- No insert/delete grant - see the single-row note above.

-- Seed value confirmed in conversation: verified 2026-09-22. updated_by is
-- null here - no human set this particular value, it's the migration's own
-- starting point, not a real edit.
insert into public.exchange_rates (usd_to_cad, updated_at, updated_by)
values (1.4067, now(), null);

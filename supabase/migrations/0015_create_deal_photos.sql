-- LOKI Coach CRM v2 - trade-in vehicle photos ("Véhicule en échange", Deal
-- Drawer Section 1). Private Supabase Storage bucket + a deal_photos table
-- (several photos per deal, not a single column) - confirmed in
-- conversation: no permanent/public links, ever. Every photo is served via
-- a short-lived (1h) signed URL generated client-side on demand
-- (storage.from('trade-in-photos').createSignedUrls(...)), never persisted
-- anywhere (not in this table, not cached beyond component state) - the
-- private bucket + RLS below is the actual access boundary, not obscurity.
-- Some clients have a high-value financial profile, hence the low ceiling
-- on exposure if a URL were ever copied/logged/shared.

-- Private bucket - `public: false` means storage.objects has no anonymous
-- read path at all, only a signed URL (itself only issuable to a caller who
-- satisfies the SELECT policy below at signing time) or an authenticated
-- request that satisfies the policies. file_size_limit/allowed_mime_types
-- are enforced by the Storage service itself, not just the client-side
-- checks in TradeInPhotos.tsx - a raw API call that bypasses the app's UI
-- still gets rejected. RLS is already enabled by default on
-- storage.objects/storage.buckets by the Supabase platform - not something
-- this migration needs to turn on.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-in-photos',
  'trade-in-photos',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create table if not exists public.deal_photos (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  storage_path text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.deal_photos enable row level security;

-- Same is_internal() gate as every other "interne" table in this project -
-- every admin/internal rep can see and manage every deal's photos, no
-- per-owner scoping (matches how deals/contacts already work).
create policy "interne lit deal_photos" on public.deal_photos
  for select
  using (public.is_internal());

create policy "interne ajoute deal_photos" on public.deal_photos
  for insert
  with check (public.is_internal());

-- DELIBERATE EXCEPTION to this project's "no physical deletion, ever" rule
-- (see 0004_grant_authenticated_privileges.sql and the README's "Functional
-- coverage" section - no DELETE is granted on any other table; contacts,
-- deals and activities are archived, never deleted). Confirmed explicitly
-- in conversation: a trade-in photo is a secondary attachment, not a client
-- record, so individual deletion (gated by a confirmation step in the UI)
-- is allowed here. Do not copy this DELETE grant/policy pattern onto
-- another table without the same explicit sign-off.
create policy "interne supprime deal_photos" on public.deal_photos
  for delete
  using (public.is_internal());

grant select, insert, delete on public.deal_photos to authenticated;
-- No update grant/policy - a photo is replaced (delete + re-upload), never edited in place.

-- Hard cap of 12 photos/deal, enforced here as a backstop behind the
-- client-side check in TradeInPhotos.tsx - a direct Storage/API call that
-- bypasses the UI still can't exceed it.
create or replace function public.enforce_deal_photos_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.deal_photos where deal_id = new.deal_id) >= 12 then
    raise exception 'Maximum de 12 photos par véhicule atteint.';
  end if;
  return new;
end;
$function$;

create trigger deal_photos_limit
  before insert on public.deal_photos
  for each row execute function public.enforce_deal_photos_limit();

-- Storage RLS - governs the actual file bytes in storage.objects, separate
-- from the deal_photos row policies above (a row and its file are two
-- distinct resources to Postgres/Storage, both need their own policy).
-- Scoped to this one bucket only, same is_internal() gate. `name` is
-- storage.objects' column for what this app calls storage_path.
create policy "interne lit trade-in-photos" on storage.objects
  for select
  using (bucket_id = 'trade-in-photos' and public.is_internal());

create policy "interne ajoute trade-in-photos" on storage.objects
  for insert
  with check (bucket_id = 'trade-in-photos' and public.is_internal());

create policy "interne supprime trade-in-photos" on storage.objects
  for delete
  using (bucket_id = 'trade-in-photos' and public.is_internal());

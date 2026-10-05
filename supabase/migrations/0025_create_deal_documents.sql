-- LOKI Coach CRM v2 - deal documents (contracts, PDFs - "Fermé-gagné").
-- Mirrors supabase/migrations/0015_create_deal_photos.sql's infrastructure
-- almost exactly (private bucket, signed URLs only, is_internal() RLS, a
-- documented individual-delete exception) - see that file's own header for
-- the full rationale, not repeated here. What's different: a cap of 10
-- instead of 12 (confirmed in conversation - deals rarely accumulate as
-- many real documents as a vehicle gets photos), original_name/mime_type/
-- size_bytes columns (shown in the UI, unlike photos which are previewed as
-- thumbnails and never need their filename), and an automatic activities
-- entry per upload (photos get none today - a signed contract is judged
-- important enough to show up in "Historique & notes" on its own, without
-- relying on someone remembering to also leave a note).

-- =========================================================================
-- 1. Widen activities.type BEFORE anything below can reference 'document' -
--    this table's own CHECK constraint on `type` was last captured in this
--    repo's history back in 0001_init.sql (note_premier_contact/note_suivi/
--    etc.), but lib/types.ts's ActivityType union has long since diverged
--    from that list (note/appel/courriel/texto/rencontre/changement_etape/
--    autre) - the live constraint was clearly altered directly against the
--    database at some point outside this migrations folder, confirmed
--    absent here before writing this. Rather than guess at its current
--    exact definition (which this session has no way to introspect
--    directly), this finds whatever check constraint currently governs the
--    `type` column by catalog lookup (not by a guessed name) and rebuilds
--    it as the union of: every value actually present in live data right
--    now (so this can never reject a historical row, regardless of what
--    undocumented values might exist), the full current app-level list,
--    and 'document'. Runs in the same migration/transaction as the trigger
--    below that depends on it - either both land together or neither does,
--    so there's no window where that trigger could fire against a
--    constraint that doesn't yet allow 'document' and abort an upload.
-- =========================================================================
do $$
declare
  existing_types text[];
  known_types text[] := array['note','appel','courriel','texto','rencontre','changement_etape','autre','document'];
  merged_types text[];
  existing_constraint text;
begin
  select coalesce(array_agg(distinct type), array[]::text[])
    into existing_types
    from public.activities;

  select array(select distinct unnest(known_types || existing_types)) into merged_types;

  -- Belt-and-suspenders: an inline `check (...)` with no explicit name (as
  -- 0001_init.sql wrote it) gets Postgres's default <table>_<column>_check
  -- name, which this drops unconditionally first (a no-op via IF EXISTS if
  -- it was never named that). The catalog lookup right after then catches
  -- any OTHER name the live constraint might actually have today, from
  -- whatever undocumented change gave it the current value list.
  execute 'alter table public.activities drop constraint if exists activities_type_check';

  select con.conname into existing_constraint
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
  where con.conrelid = 'public.activities'::regclass
    and con.contype = 'c'
    and att.attname = 'type';

  if existing_constraint is not null then
    execute format('alter table public.activities drop constraint %I', existing_constraint);
  end if;

  execute format(
    'alter table public.activities add constraint activities_type_check check (type = any (%L::text[]))',
    merged_types
  );
end $$;

-- =========================================================================
-- 2. Private bucket - separate from trade-in-photos rather than a shared
--    bucket with a prefix: allowed_mime_types/file_size_limit apply to a
--    whole bucket, and PDFs (primary use case here) vs. photos warrant
--    different limits, not one diluted policy for both. 20 MiB rather than
--    trade-in-photos' 10 MiB - a multi-page scanned contract can be
--    heavier than a phone photo.
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-documents',
  'deal-documents',
  false,
  20971520, -- 20 MiB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  storage_path text not null unique,
  -- Shown in the UI (document list, activity log) - storage_path itself
  -- stays an opaque random id + extension, same as deal_photos, so this is
  -- purely display, never a path component (no path-traversal surface).
  original_name text not null check (char_length(original_name) <= 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.deal_documents enable row level security;

create policy "interne lit deal_documents" on public.deal_documents
  for select
  using (public.is_internal());

create policy "interne ajoute deal_documents" on public.deal_documents
  for insert
  with check (public.is_internal());

-- DELIBERATE EXCEPTION to this project's "no physical deletion, ever" rule
-- (see 0004_grant_authenticated_privileges.sql and the README's "Functional
-- coverage" section - no DELETE is granted on any other table; contacts,
-- deals and activities are archived, never deleted). Same exception already
-- made for deal_photos (0015_create_deal_photos.sql) and reused here on the
-- same reasoning, confirmed in conversation: a document attached to a deal
-- is a secondary attachment, not a client record, so individual deletion
-- (gated by a confirmation step in the UI) is allowed. Do not copy this
-- DELETE grant/policy pattern onto another table without the same explicit
-- sign-off.
create policy "interne supprime deal_documents" on public.deal_documents
  for delete
  using (public.is_internal());

grant select, insert, delete on public.deal_documents to authenticated;
-- No update grant/policy - a document is replaced (delete + re-upload), never edited in place.

-- =========================================================================
-- 3. Cap of 10 documents/deal - enforced here as a backstop behind the
--    client-side check in the upload component, same shape as
--    enforce_deal_photos_limit (deal_photos' cap is 12 - deliberately
--    different here, confirmed in conversation: a deal rarely accumulates
--    as many real documents as a vehicle gets photos).
-- =========================================================================
create or replace function public.enforce_deal_documents_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.deal_documents where deal_id = new.deal_id) >= 10 then
    raise exception 'Maximum de 10 documents par dossier atteint.';
  end if;
  return new;
end;
$function$;

create trigger deal_documents_limit
  before insert on public.deal_documents
  for each row execute function public.enforce_deal_documents_limit();

-- =========================================================================
-- 4. Auto-log an activities entry per upload - mirrors log_first_contact()'s
--    SECURITY DEFINER + auth.uid() pattern (0013_add_premier_contact.sql)
--    so "who and when" is captured server-side regardless of which app code
--    path performs the insert, not trusted to whatever the client sends.
--    deal_documents has no contact_id column of its own (same shape as
--    deal_photos), so it's looked up from deals - deals.contact_id is
--    not-null, this can never come back null for a real deal_id.
--    original_name is truncated defensively to 100 characters here
--    regardless of what's actually stored (checked at 255 above) - keeps
--    the activity feed line bounded even if some future insert path ever
--    bypasses the client-side 200-character cap.
-- =========================================================================
create or replace function public.log_deal_document_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contact_id uuid;
begin
  select contact_id into v_contact_id from public.deals where id = new.deal_id;

  insert into public.activities (deal_id, contact_id, type, contenu, created_by)
  values (new.deal_id, v_contact_id, 'document', 'Document ajouté : ' || left(new.original_name, 100), auth.uid());

  return new;
end;
$function$;

create trigger deal_documents_log_added
  after insert on public.deal_documents
  for each row execute function public.log_deal_document_added();

-- =========================================================================
-- 5. Storage RLS - governs the actual file bytes in storage.objects,
--    separate from the deal_documents row policies above (a row and its
--    file are two distinct resources to Postgres/Storage, both need their
--    own policy). Scoped to this one bucket only, same is_internal() gate.
-- =========================================================================
create policy "interne lit deal-documents" on storage.objects
  for select
  using (bucket_id = 'deal-documents' and public.is_internal());

create policy "interne ajoute deal-documents" on storage.objects
  for insert
  with check (bucket_id = 'deal-documents' and public.is_internal());

create policy "interne supprime deal-documents" on storage.objects
  for delete
  using (bucket_id = 'deal-documents' and public.is_internal());

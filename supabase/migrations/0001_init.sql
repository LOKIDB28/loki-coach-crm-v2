-- LOKI Coach CRM v2 - initial schema
-- Ports the data model of the legacy loki-coach-crm.jsx prototype to
-- Postgres + Row Level Security on Supabase.
--
-- NOT RUN AGAINST loki-crm-prod. This scaffold was connected to a
-- pre-existing production Supabase project (loki-crm-prod, ref
-- lxujdwlhcsgfsvqrtgfq) with its own real schema (contacts/deals split,
-- pipeline_stages, coaches, tasks - see the project README's "Data model"
-- section). This file is kept as historical documentation of the
-- scaffold's original single-table design only; the actual app runs
-- against 0002_extend_deals_for_mvp.sql applied on top of the real schema.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- One row per team member (Supabase Auth user). Replaces the hardcoded
-- REPRESENTANTS array from the prototype: owner_id on clients references
-- this table and can be assigned to any team member.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text,
  email text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Team member profile. One row per Supabase Auth user, bootstrapped by the '
  'handle_new_user trigger below on first sign-up.';

-- Bootstrap a profile row automatically whenever a new auth.users row is
-- created (i.e. the first time someone completes a magic-link sign-in).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  stage int not null default 1 check (stage between 1 and 6),
  type_client text not null default 'Particulier'
    check (type_client in ('Particulier', 'Concessionnaire')),
  owner_id uuid references public.profiles (id) on delete set null,

  -- Contact info
  prenom text,
  nom text,
  telephone text,
  email text,
  ville text,
  code_postal text,

  -- Stage 1 - Premier contact
  provenance text
    check (provenance is null or provenance in (
      'Site web', 'Salon / Exposition', 'Référence client', 'Réseaux sociaux',
      'Concessionnaire', 'Publicité', 'Événement sportif', 'Autre'
    )),
  niveau_interet text
    check (niveau_interet is null or niveau_interet in ('Faible', 'Moyen', 'Élevé', 'Très élevé')),
  coach_neuf_vise text,
  coach_unite text,
  coach_marque text,
  coach_modele text,
  coach_annee text,
  coach_km text,
  coach_accidente text
    check (coach_accidente is null or coach_accidente in ('Non accidenté', 'Accidenté', 'Inconnu')),

  -- Stage 2 - Suivi
  follow_up_date timestamptz,
  evaluation_client text
    check (evaluation_client is null or evaluation_client in (
      'Très intéressé — prêt à avancer', 'Intéressé — besoin de temps', 'Hésitant', 'Froid'
    )),

  -- Stage 3 - Usine & essai
  visite_usine_date timestamptz,
  essai_routier_date timestamptz,

  -- Stage 4 - Proposition
  prix_vente numeric,
  options text,
  echange_description text,
  echange_numero_serie text,
  echange_valeur numeric,

  -- Stage 5 - Contrat
  date_contrat date,
  numero_contrat text,
  montant_final numeric,

  -- Stage 6 - 1er service
  date_rdv_service date
);

comment on table public.clients is
  'Prospects/clients pipeline. Mirrors emptyClient() from the legacy '
  'loki-coach-crm.jsx prototype; per-stage free-text note fields were '
  'replaced by append-only rows in public.activities.';

create index if not exists clients_stage_idx on public.clients (stage);
create index if not exists clients_owner_id_idx on public.clients (owner_id);
create index if not exists clients_follow_up_date_idx on public.clients (follow_up_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities
-- Append-only interaction/history feed per client. Replaces the six
-- per-stage free-text note fields (notes1, followUpNotes, notesVisite,
-- notesProposition, notesContrat, notesService) from the prototype, plus
-- records every pipeline stage change.
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null check (type in (
    'note_premier_contact',
    'note_suivi',
    'note_visite',
    'note_proposition',
    'note_contrat',
    'note_service',
    'changement_etape',
    'autre'
  )),
  contenu text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.activities is
  'Append-only note/history feed per client. Never edited in place - a '
  'correction is a new row, consistent with the historique-des-modifications '
  'requirement.';

create index if not exists activities_client_id_idx on public.activities (client_id);
create index if not exists activities_created_at_idx on public.activities (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.activities enable row level security;

-- profiles: any authenticated user can read every profile (needed to
-- populate the owner dropdown and to show activity authors); a user may
-- only insert/update their own row.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- clients: shared team visibility - every authenticated user can read and
-- write every row. This intentionally matches the prototype's current
-- no-restriction behaviour; do not add owner-based filtering here.
drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated"
  on public.clients for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "clients_insert_authenticated" on public.clients;
create policy "clients_insert_authenticated"
  on public.clients for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated"
  on public.clients for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_delete_authenticated"
  on public.clients for delete
  to authenticated
  using (auth.uid() is not null);

-- activities: same shared-visibility model as clients.
drop policy if exists "activities_select_authenticated" on public.activities;
create policy "activities_select_authenticated"
  on public.activities for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "activities_insert_authenticated" on public.activities;
create policy "activities_insert_authenticated"
  on public.activities for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "activities_update_authenticated" on public.activities;
create policy "activities_update_authenticated"
  on public.activities for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "activities_delete_authenticated" on public.activities;
create policy "activities_delete_authenticated"
  on public.activities for delete
  to authenticated
  using (auth.uid() is not null);

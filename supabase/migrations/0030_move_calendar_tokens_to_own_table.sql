-- LOKI Coach CRM v2 - moves the .ics feed tokens out of public.profiles into
-- their own owner-only table.
--
-- Why: confirmed on the live database - `authenticated` holds table-level
-- SELECT and UPDATE on public.profiles (0004_grant_authenticated_privileges),
-- and in PostgreSQL a column-level REVOKE does not override a table-level
-- GRANT. 0014's `revoke select (calendar_token) ... from authenticated`
-- therefore never took effect: through the "interne lit profils" policy,
-- every internal user could read every colleague's calendar_token, i.e.
-- open any colleague's feed. Rather than rework profiles' grants column by
-- column (every app query on profiles depends on them), the token gets a
-- table of its own whose only read path is the owner's own row.
--
-- Nobody has to resubscribe: section 2 copies every current token as-is,
-- so every URL already pasted in Outlook keeps working.
--
-- profiles.calendar_token is NOT dropped here (separate migration later).
-- But it can't keep holding live tokens either - colleagues can still read
-- that column - so section 5 empties it once the switch is verified.
--
-- Admin procedure when a rep leaves (comment only - replaces the one that
-- was in 0029; run by hand in the SQL Editor, then verify):
--
--   update public.calendar_tokens
--      set token = extensions.uuid_generate_v4()::text
--    where profile_id = (select id from public.profiles
--                         where email = '<adresse du représentant>');
--
--   -- vérification : exactement 1 ligne
--   select t.profile_id, length(t.token) from public.calendar_tokens t
--   join public.profiles p on p.id = t.profile_id
--   where p.email = '<adresse du représentant>';
--
-- That single update cuts off the departed rep's Outlook subscription:
-- their old URL no longer matches any token.
--
-- HOW TO RUN: sections 1 to 4 form a single transaction (begin/commit
-- included) - run them together, so no regeneration can slip in between
-- the copy and the switch. Then the section 4 checks. Then section 5 alone,
-- then its check.

begin;

-- =========================================================================
-- 1. Table. RLS: the owner reads their own row; no write policy at all -
--    the only writers are the SECURITY DEFINER functions below (they run as
--    the table owner and bypass RLS). Grants narrowed explicitly: Supabase's
--    default privileges grant ALL on new public tables to anon,
--    authenticated and service_role.
-- =========================================================================

create table public.calendar_tokens (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.calendar_tokens is
  'Secret token for each rep''s .ics calendar feed (/api/calendar/[token].ics), one row per profile. Readable by its owner only; written only by regenerate_my_calendar_token() and the profiles insert trigger. Moved here from profiles.calendar_token in 0030.';

alter table public.calendar_tokens enable row level security;

create policy "propriétaire lit son jeton" on public.calendar_tokens
  for select
  to authenticated
  using (auth.uid() = profile_id);

revoke all on public.calendar_tokens from public, anon, authenticated, service_role;
grant select on public.calendar_tokens to authenticated;

-- =========================================================================
-- 2. Copy every current token, unchanged.
-- =========================================================================

insert into public.calendar_tokens (profile_id, token)
select id, calendar_token
from public.profiles
where calendar_token is not null;

-- =========================================================================
-- 3. New profiles get their token row automatically - this replaces the
--    profiles.calendar_token column default (dropped in section 5). Same
--    generator as before: extensions.uuid_generate_v4()::text.
-- =========================================================================

create or replace function public.create_calendar_token_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.calendar_tokens (profile_id, token)
  values (new.id, extensions.uuid_generate_v4()::text)
  on conflict (profile_id) do nothing;
  return new;
end;
$function$;

revoke execute on function public.create_calendar_token_for_profile() from public, anon, authenticated;

create trigger on_profile_created_calendar_token
  after insert on public.profiles
  for each row execute function public.create_calendar_token_for_profile();

-- =========================================================================
-- 4. The three functions now read/write calendar_tokens. Same names, same
--    arguments, same return types, same grants as before (0014, 0019,
--    0029) - restated below as they were, nothing widened.
-- =========================================================================

-- 4a. Caller's own token (0014). Never anyone else's: auth.uid() only.
create or replace function public.get_my_calendar_token()
returns text
language sql
security definer
set search_path to 'public'
stable
as $function$
  select token from public.calendar_tokens where profile_id = auth.uid();
$function$;

revoke all on function public.get_my_calendar_token() from public;
grant execute on function public.get_my_calendar_token() to authenticated;

-- 4b. Public feed lookup (0019). Body unchanged except the `rep` CTE, which
-- now resolves the token through calendar_tokens. The relance branch stays
-- a LEFT JOIN: a valid token with zero qualifying deals still returns one
-- row (rep_nom set, the rest null), an unknown token zero rows - the route
-- handler's 404-vs-empty-calendar decision depends on it.
create or replace function public.get_calendar_feed(p_token text)
returns table (
  rep_nom text,
  deal_id uuid,
  contact_prenom text,
  contact_nom text,
  montant numeric,
  event_type text,
  event_at timestamptz,
  event_date_only text
)
language sql
security definer
set search_path to 'public'
stable
as $function$
  with rep as (
    select p.id, p.nom
    from public.calendar_tokens t
    join public.profiles p on p.id = t.profile_id
    where t.token = p_token
  )
  select rep.nom, d.id, c.prenom, c.nom, d.montant, 'relance'::text, d.next_action_at, null::text
  from rep
  left join public.deals d
    on d.owner_id = rep.id and d.archived = false and d.next_action_at is not null
  left join public.contacts c on c.id = d.contact_id

  union all

  select rep.nom, d.id, c.prenom, c.nom, d.montant, 'essai_routier'::text, d.date_essai_routier, null::text
  from rep
  join public.deals d
    on d.owner_id = rep.id and d.archived = false and d.date_essai_routier is not null
  join public.contacts c on c.id = d.contact_id

  union all

  select rep.nom, d.id, c.prenom, c.nom, d.montant, 'visite_usine'::text, d.date_visite_usine, null::text
  from rep
  join public.deals d
    on d.owner_id = rep.id and d.archived = false and d.date_visite_usine is not null
  join public.contacts c on c.id = d.contact_id

  union all

  select rep.nom, d.id, c.prenom, c.nom, d.montant, 'visite_bureau'::text, d.date_visite_bureau, null::text
  from rep
  join public.deals d
    on d.owner_id = rep.id and d.archived = false and d.date_visite_bureau is not null
  join public.contacts c on c.id = d.contact_id

  union all

  select rep.nom, d.id, c.prenom, c.nom, d.montant, 'rdv_service'::text, null::timestamptz, to_char(d.date_rdv_service, 'YYYY-MM-DD')
  from rep
  join public.deals d
    on d.owner_id = rep.id and d.archived = false and d.date_rdv_service is not null
  join public.contacts c on c.id = d.contact_id;
$function$;

revoke all on function public.get_calendar_feed(text) from public;
grant execute on function public.get_calendar_feed(text) to anon;

-- 4c. Regenerate (0029). Same contract: refuses without auth.uid(), touches
-- only the caller's own row, returns the new token (same generator, same
-- 36-character lowercase UUID v4 shape the route expects).
create or replace function public.regenerate_my_calendar_token()
returns text
language plpgsql
security definer
set search_path = public
volatile
as $function$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'regenerate_my_calendar_token: session requise'
      using errcode = '42501';
  end if;

  update public.calendar_tokens
     set token = extensions.uuid_generate_v4()::text
   where profile_id = v_uid
  returning token into v_token;

  if v_token is null then
    raise exception 'regenerate_my_calendar_token: aucun jeton pour cet utilisateur'
      using errcode = 'P0002';
  end if;

  return v_token;
end;
$function$;

revoke execute on function public.regenerate_my_calendar_token() from public;
revoke execute on function public.regenerate_my_calendar_token() from anon;
grant execute on function public.regenerate_my_calendar_token() to authenticated;

commit;

-- Checks after sections 1-4 (read-only):
--   -- same count, same values: expected 0 rows
--   select p.id from public.profiles p
--   left join public.calendar_tokens t on t.profile_id = p.id
--   where t.token is distinct from p.calendar_token;
--
--   -- grants: expected f, t, f, f
--   select has_table_privilege('anon', 'public.calendar_tokens', 'select'),
--          has_table_privilege('authenticated', 'public.calendar_tokens', 'select'),
--          has_table_privilege('authenticated', 'public.calendar_tokens', 'update'),
--          has_table_privilege('authenticated', 'public.calendar_tokens', 'insert');
--
-- Then open your own feed URL (Paramètres) in a browser: it must still
-- return the calendar, not a 404. Only then run section 5.

-- =========================================================================
-- 5. Empty profiles.calendar_token. Colleagues can still SELECT this column
--    (table-level grant), so it must stop holding live tokens. Not dropped:
--    a later migration does that. The values are not lost - section 2
--    copied them into calendar_tokens, which every function now reads.
-- =========================================================================

alter table public.profiles alter column calendar_token drop default;
alter table public.profiles alter column calendar_token drop not null;
update public.profiles set calendar_token = null;

comment on column public.profiles.calendar_token is
  'Obsolete since 0030 - always null, kept only until a later migration drops it. Tokens live in public.calendar_tokens.';

-- Check after section 5 (read-only): expected 0
--   select count(*) from public.profiles where calendar_token is not null;

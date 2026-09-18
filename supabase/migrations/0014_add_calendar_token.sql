-- LOKI Coach CRM v2 - per-rep .ics calendar feed token.
--
-- calendar_token is intentionally NEVER exposed through a normal table
-- SELECT, even though `authenticated` already has table-wide SELECT on
-- profiles (migration 0004) and the existing "interne lit profils" RLS
-- policy (USING is_internal()) makes every row visible to every internal
-- rep - confirmed before writing this, not assumed: without the explicit
-- REVOKE below, adding this column would let any rep read every other
-- rep's token through the exact same broad queries already in the app
-- (e.g. the "Représentant" dropdown's profiles fetch). The two functions
-- below are the only way to read a token: get_my_calendar_token() only
-- ever returns the caller's own (via auth.uid()), and get_calendar_feed()
-- takes a token as input rather than exposing the column at all.

alter table public.profiles
  add column if not exists calendar_token text unique not null default extensions.uuid_generate_v4()::text;

revoke select (calendar_token) on public.profiles from authenticated;

comment on column public.profiles.calendar_token is
  'Secret token for this rep''s .ics calendar feed (/api/calendar/[token].ics) - never selectable directly, see get_my_calendar_token()/get_calendar_feed().';

-- Returns the calling user's own token - never anyone else's, regardless
-- of the RLS policy governing normal table access, since this only ever
-- looks up auth.uid()'s own row.
create or replace function public.get_my_calendar_token()
returns text
language sql
security definer
set search_path to 'public'
stable
as $function$
  select calendar_token from public.profiles where id = auth.uid();
$function$;

revoke all on function public.get_my_calendar_token() from public;
grant execute on function public.get_my_calendar_token() to authenticated;

-- Public feed lookup - callable with no session at all (Outlook has no
-- login), so the token in the URL is the only credential. LEFT JOIN so a
-- valid token with zero qualifying deals still returns exactly one row
-- (rep_nom set, every deal field null) - distinct from an unknown token,
-- which returns zero rows. The route handler uses that distinction to
-- decide between an empty-but-valid calendar and a 404.
create or replace function public.get_calendar_feed(p_token text)
returns table (
  rep_nom text,
  deal_id uuid,
  contact_prenom text,
  contact_nom text,
  montant numeric,
  next_action_at timestamptz
)
language sql
security definer
set search_path to 'public'
stable
as $function$
  select
    p.nom,
    d.id,
    c.prenom,
    c.nom,
    d.montant,
    d.next_action_at
  from public.profiles p
  left join public.deals d
    on d.owner_id = p.id
    and d.archived = false
    and d.next_action_at is not null
  left join public.contacts c on c.id = d.contact_id
  where p.calendar_token = p_token;
$function$;

revoke all on function public.get_calendar_feed(text) from public;
grant execute on function public.get_calendar_feed(text) to anon;

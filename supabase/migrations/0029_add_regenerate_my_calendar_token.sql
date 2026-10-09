-- LOKI Coach CRM v2 - lets a rep replace their own .ics calendar feed token
-- (Paramètres → "Régénérer mon lien").
--
-- Why: the token in /api/calendar/<token>.ics is the feed's only credential
-- (see 0014_add_calendar_token.sql, get_calendar_feed() in 0019). Until now
-- it could never change - a link pasted in the wrong place, or left in a
-- former colleague's Outlook, stayed valid forever. Regenerating replaces
-- it: the old URL immediately stops matching any profile, so
-- get_calendar_feed() returns zero rows for it and the route answers 404.
--
-- Scope, deliberately narrow:
--   - refuses outright when auth.uid() is null (no session: anon, or
--     service_role without a user JWT);
--   - updates exactly one row - profiles.id = auth.uid() - and exactly one
--     column, calendar_token. Nothing else on that row, no other row;
--   - the new value comes from the same generator as the column default in
--     0014 (extensions.uuid_generate_v4()::text), so it has exactly the same
--     shape as every existing token: 36-character lowercase UUID v4 text,
--     which is what the route's shape check (/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i)
--     expects.
--
-- Grants: EXECUTE to authenticated only. This is an approved exception to
-- the CLAUDE.md rule that narrow write functions get EXECUTE revoked from
-- authenticated (that rule targets service_role writes): this one can only
-- ever act on the caller's own row, so letting the caller run it is the
-- point. Revoked from public and anon explicitly - Supabase's default
-- privileges grant EXECUTE on new public functions to anon as well.
--
-- SUPERSEDED by 0030: tokens now live in public.calendar_tokens and this
-- function is redefined there. The admin procedure for a departing rep
-- that used to be here updated profiles.calendar_token - after 0030 that
-- would cut off nothing. Use the procedure in 0030's header instead.

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

  update public.profiles
     set calendar_token = extensions.uuid_generate_v4()::text
   where id = v_uid
  returning calendar_token into v_token;

  -- A signed-in user with no profiles row (should never happen - the
  -- on_auth_user_created trigger creates it, see 0001) - fail loudly
  -- rather than return null to the UI.
  if v_token is null then
    raise exception 'regenerate_my_calendar_token: aucun profil pour cet utilisateur'
      using errcode = 'P0002';
  end if;

  return v_token;
end;
$function$;

revoke execute on function public.regenerate_my_calendar_token() from public;
revoke execute on function public.regenerate_my_calendar_token() from anon;
grant execute on function public.regenerate_my_calendar_token() to authenticated;

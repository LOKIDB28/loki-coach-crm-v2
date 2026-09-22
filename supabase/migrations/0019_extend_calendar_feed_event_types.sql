-- LOKI Coach CRM v2 - extends the per-rep .ics feed (get_calendar_feed(),
-- 0014_add_calendar_token.sql) from relances only to all 5 event types the
-- in-app calendar covers (lib/calendar.ts EVENT_TYPES): relance, essai
-- routier, visite d'usine, visite au bureau (deals.date_visite_bureau,
-- 0018_add_deals_date_visite_bureau.sql), rendez-vous service. Confirmed
-- before writing this: the feed genuinely only emitted next_action_at rows
-- today - the other date columns were never surfaced here at all, this
-- isn't just a title-wording fix.
--
-- `create or replace function` cannot change a RETURNS TABLE signature in
-- place, hence the explicit drop first.
drop function if exists public.get_calendar_feed(text);

create function public.get_calendar_feed(p_token text)
returns table (
  rep_nom text,
  deal_id uuid,
  contact_prenom text,
  contact_nom text,
  montant numeric,
  event_type text,
  -- Real timestamptz for relance/essai_routier/visite_usine. Null for
  -- rdv_service, which uses event_date_only instead - date_rdv_service is
  -- a plain DATE with no time-of-day, and casting it through timestamptz
  -- here would force an implicit timezone interpretation at the exact
  -- point that caused the day-shift bug already fixed once in
  -- lib/calendar.ts's parseDateOnly (Postgres session timezone at the
  -- cast site, not something the app controls). Kept out of this column
  -- entirely rather than risk reintroducing that.
  event_at timestamptz,
  -- "YYYY-MM-DD" text, set only for rdv_service - lib/ics.ts turns this
  -- into a proper RFC 5545 all-day VEVENT (DTSTART;VALUE=DATE), never
  -- routed through a Date/timezone conversion.
  event_date_only text
)
language sql
security definer
set search_path to 'public'
stable
as $function$
  with rep as (
    select id, nom from public.profiles where calendar_token = p_token
  )
  -- Relance - LEFT JOIN, same as the original function. Must stay a LEFT
  -- JOIN: it's what guarantees at least one row for a valid token even
  -- with zero qualifying deals (rep_nom set, everything else null),
  -- distinct from an unknown token (zero rows) - the route handler relies
  -- on that distinction for its 404-vs-empty-calendar decision. The other
  -- three branches below are plain JOINs (only contribute rows when that
  -- date is actually set), UNION ALL'd on top - the guarantee still holds
  -- for the combined result since this first branch alone already
  -- provides it.
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

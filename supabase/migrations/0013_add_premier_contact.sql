-- LOKI Coach CRM v2 - Phase 01: "first contact made" marker, replacing
-- Section 2's old coach_vise/coach_id form with a simple one-way toggle.
-- Additive only.

alter table public.deals
  add column if not exists premier_contact_le timestamptz;

comment on column public.deals.premier_contact_le is
  'Timestamp of first contact with the client, set once via DealDrawer Section 2''s toggle - never reset from the UI. Purpose: let the team see at a glance (DealCard badge) whether someone already called this lead, avoiding duplicate outreach.';

-- Mirrors log_stage_change() exactly (same SECURITY DEFINER + auth.uid()
-- pattern) so the "who and when" behind this marker is captured
-- server-side regardless of which app code path writes the column, not
-- trusted to whatever the client happens to send as created_by.
create or replace function public.log_first_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.premier_contact_le is null and new.premier_contact_le is not null then
    insert into activities (deal_id, contact_id, type, contenu, created_by)
    values (new.id, new.contact_id, 'autre', 'Premier contact effectué', auth.uid());
  end if;
  return new;
end;
$function$;

create trigger deals_log_first_contact
  after update on public.deals
  for each row execute function public.log_first_contact();

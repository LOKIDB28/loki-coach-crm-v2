-- LOKI Coach CRM v2 - auto-fill premier_contact_le on stage advance.
--
-- Bug fixed: a rep could move a deal past "Contact" (kanban drag-and-drop
-- or the DealDrawer stepper arrows) without ever clicking "Marquer comme
-- contacté", leaving premier_contact_le null on a deal someone had clearly
-- already taken - DealCard's lead-age badge then kept showing (fixed
-- separately by gating the badge on stage code) but the underlying data
-- gap remained: no real first-contact timestamp/author was ever recorded.
--
-- Centralized here (one BEFORE UPDATE trigger) rather than duplicated in
-- both KanbanBoard.tsx and DealDrawer.tsx's stepper - same reasoning as
-- the REP_TAB_ORDER extraction into lib/domain.ts: one authoritative
-- source instead of two copies that can drift. Both the kanban drag
-- (handleMoveDealStage) and the stepper arrows (handleChangeStage) already
-- funnel through the same changeDealStage()/plain `update deals set
-- stage_id = ...` - a DB trigger catches both uniformly with zero
-- awareness needed in either client code path, matching how
-- deals_log_stage/deals_log_first_contact (0013_add_premier_contact.sql)
-- already work.
create or replace function public.auto_first_contact_on_stage_advance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
begin
  -- Only on an actual stage change, not any other edit to an already
  -- Rencontre-or-later deal - and only if the client's own UPDATE didn't
  -- already set premier_contact_le itself (handleMarkContacted's
  -- Prospect->Contact patch sets both columns in one write; this trigger
  -- must not clobber that with a second, slightly later now()).
  if new.premier_contact_le is null and new.stage_id is distinct from old.stage_id then
    select code into v_code from public.pipeline_stages where id = new.stage_id;
    if v_code not in ('prospect', 'contact') then
      new.premier_contact_le := now();
    end if;
  end if;
  return new;
end;
$function$;

-- BEFORE UPDATE (not AFTER, unlike deals_log_stage/deals_log_first_contact)
-- so it can mutate NEW before the row is written. All BEFORE triggers run
-- before all AFTER triggers on the same statement regardless of trigger
-- name, so deals_log_first_contact - which reacts to
-- "old.premier_contact_le is null and new.premier_contact_le is not null"
-- - still fires correctly off the value this trigger just set, logging the
-- exact same "Premier contact effectué" activity as the manual button, no
-- new logging code needed anywhere.
create trigger deals_auto_first_contact
  before update on public.deals
  for each row execute function public.auto_first_contact_on_stage_advance();

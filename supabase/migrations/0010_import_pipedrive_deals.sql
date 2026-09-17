-- LOKI Coach CRM v2 - import the 63 Pipedrive deals staged in 0009 as new
-- contacts + new deals. Additive only - no existing contact/deal is ever
-- read for matching, updated, or touched in any way.
--
-- Explicit decision (see conversation): every one of the 63 rows becomes
-- its own brand-new contact, with NO fusion against existing contacts -
-- not for an exact name match, an accent-only difference, a nickname
-- suffix, or an ambiguous/malformed name ("Carl", "M.63", "Bob Aloi
-- Ultimate RV"). The app's existing duplicate-detection banner ("Ce client
-- existe déjà ailleurs") already flags every one of these automatically
-- once imported - that's what it's for. Merging happens manually in the
-- UI with both records visible, not guessed here from a name string alone.
--
-- Name splitting: contacts.prenom/nom are both NOT NULL but Pipedrive only
-- gives one "Contact person" string. First word -> prenom, remainder ->
-- nom - the same convention already present in this system's own existing
-- data (e.g. "Thomas" / "E. Boehland (Tombo)"). A single-word name (e.g.
-- "Joel", "Carl") gets an empty nom rather than a guessed one.
--
-- Stage mapping (confirmed in conversation):
--   First contact / exchange   -> contact      (37 deals)
--   Follow-up in process       -> contact       (10 deals - confirmed same as above, not rencontre)
--   Visit / Full Prensentation -> rencontre      (5 deals)
--   Proposal sent              -> proposition    (7 deals)
--   Contract Sent              -> negociation    (2 deals)
--   Contract Signed            -> gagne          (2 deals)
-- staging_pipedrive.stage is compared after whitespace normalization
-- (collapses the non-breaking space present in two of the six raw values,
-- confirmed against the source CSV - and any other stray whitespace)
-- rather than as a literal string match.
--
-- Owner mapping (confirmed): Pierre-Mathieu Roy -> pm@lokicoach.com,
-- Jeff Gagne -> jeff@lokicoach.com, Frederick -> frederick.sabourin@lokicoach.com
-- (a single first name - explicitly confirmed rather than assumed, since
-- it isn't a full-name match like the other two).
--
-- Montant: Deal - Value, two confirmed rules applied before writing:
--   - 0 -> NULL (no montant known yet), not a literal zero
--   - USD -> converted to CAD at 1.39 (verified rate, checked 2026-09-16 -
--     see README "Conversions de devises appliquées" for the full list of
--     the 15 affected deals and how to re-derive the original USD figure
--     if a real historical-date rate is needed later)
--
-- canal = 'direct' for both the new contacts and deals - these are
-- internally-tracked deals with real internal owners (PM/Jeff/Frederick),
-- not TMCS-distributor deals.
--
-- Both stage and owner mapping raise an exception (aborting the whole
-- transaction) rather than silently inserting a null if a staged value
-- doesn't match anything expected - every one of the 63 rows was verified
-- against these exact six stage values and three owner values before this
-- was written, so neither should ever actually fire.

do $$
declare
  r record;
  new_contact_id uuid;
  v_prenom text;
  v_nom text;
  v_full text;
  v_space_pos int;
  v_stage_norm text;
  v_stage_id smallint;
  v_owner_id uuid;
  v_value numeric;
  v_montant numeric;
  v_contact_count int := 0;
  v_deal_count int := 0;
begin
  for r in select * from public.staging_pipedrive order by id loop
    v_full := trim(r.contact_person);
    v_space_pos := position(' ' in v_full);
    if v_space_pos = 0 then
      v_prenom := v_full;
      v_nom := '';
    else
      v_prenom := substring(v_full from 1 for v_space_pos - 1);
      v_nom := trim(substring(v_full from v_space_pos + 1));
    end if;

    insert into public.contacts (prenom, nom, canal, type_contact)
    values (v_prenom, v_nom, 'direct', 'particulier')
    returning id into new_contact_id;
    v_contact_count := v_contact_count + 1;

    v_stage_norm := regexp_replace(replace(trim(r.stage), chr(160), ' '), '\s+', ' ', 'g');
    v_stage_id := case v_stage_norm
      when 'First contact / exchange' then (select id from public.pipeline_stages where code = 'contact')
      when 'Follow-up in process' then (select id from public.pipeline_stages where code = 'contact')
      when 'Visit / Full Prensentation' then (select id from public.pipeline_stages where code = 'rencontre')
      when 'Proposal sent' then (select id from public.pipeline_stages where code = 'proposition')
      when 'Contract Sent' then (select id from public.pipeline_stages where code = 'negociation')
      when 'Contract Signed' then (select id from public.pipeline_stages where code = 'gagne')
      else null
    end;

    if v_stage_id is null then
      raise exception 'Unmapped stage value: % (normalized: %) for pipedrive_deal_id %', r.stage, v_stage_norm, r.pipedrive_deal_id;
    end if;

    v_owner_id := case trim(r.owner)
      when 'Pierre-Mathieu Roy' then (select id from public.profiles where email = 'pm@lokicoach.com')
      when 'Jeff Gagne' then (select id from public.profiles where email = 'jeff@lokicoach.com')
      when 'Frederick' then (select id from public.profiles where email = 'frederick.sabourin@lokicoach.com')
      else null
    end;

    if v_owner_id is null then
      raise exception 'Unmapped owner value: % for pipedrive_deal_id %', r.owner, r.pipedrive_deal_id;
    end if;

    v_value := nullif(trim(r.value), '')::numeric;
    if v_value is not null and trim(r.currency) = 'USD' then
      v_value := v_value * 1.39;
    end if;
    if v_value is null or v_value = 0 then
      v_montant := null;
    else
      v_montant := v_value;
    end if;

    insert into public.deals (contact_id, titre, stage_id, montant, owner_id, canal)
    values (new_contact_id, r.title, v_stage_id, v_montant, v_owner_id, 'direct');
    v_deal_count := v_deal_count + 1;
  end loop;

  raise notice 'Pipedrive import complete: % new contacts, % new deals', v_contact_count, v_deal_count;
end $$;

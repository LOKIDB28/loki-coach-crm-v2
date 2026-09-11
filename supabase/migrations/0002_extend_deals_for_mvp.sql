-- LOKI Coach CRM v2 - extend loki-crm-prod for MVP field coverage
--
-- Purely additive: every column below is nullable, no default that could
-- affect existing rows, no rename/drop of anything that already exists.
-- Reconciles the MVP field list in README.md (ported from the legacy
-- loki-coach-crm.jsx prototype) against the real schema, which was built
-- with a proper contacts/deals split and does not yet carry these
-- per-deal fields anywhere.
--
-- Safe to run against loki-crm-prod (project ref lxujdwlhcsgfsvqrtgfq) via
-- the Supabase SQL editor. Does not touch contacts, activities, coaches,
-- pipeline_stages, profiles, or tasks.

alter table public.deals
  -- Stage 1 (Prospect / Premier contact) - free-text targeting fields used
  -- by the ported duplicate-detection logic (findCoachMatches).
  add column if not exists coach_neuf_vise text,
  add column if not exists coach_unite text,

  -- Engagement signal - not captured anywhere else in the real schema.
  add column if not exists niveau_interet text
    check (niveau_interet is null or niveau_interet in ('Faible', 'Moyen', 'Élevé', 'Très élevé')),
  add column if not exists evaluation_client text
    check (evaluation_client is null or evaluation_client in (
      'Très intéressé — prêt à avancer', 'Intéressé — besoin de temps', 'Hésitant', 'Froid'
    )),

  -- Stage 3 (Rencontre / Usine & essai).
  add column if not exists visite_usine_date timestamptz,
  add column if not exists essai_routier_date timestamptz,

  -- Trade-in vehicle description (valeur_echange already exists as a
  -- numeric column; these are the structured details around it).
  add column if not exists echange_marque text,
  add column if not exists echange_modele text,
  add column if not exists echange_annee text,
  add column if not exists echange_km text,
  add column if not exists echange_description text,
  add column if not exists echange_numero_serie text,
  add column if not exists echange_accidente text
    check (echange_accidente is null or echange_accidente in ('Non accidenté', 'Accidenté', 'Inconnu')),

  -- Stage 5 (Contrat). `montant` already exists and is reused as the
  -- proposal/deal value; montant_final is the distinct signed-contract amount.
  add column if not exists date_contrat date,
  add column if not exists numero_contrat text,
  add column if not exists montant_final numeric(12, 2),

  -- Stage 6 (1er service).
  add column if not exists date_rdv_service date;

comment on column public.deals.coach_neuf_vise is
  'Free-text description of the new coach targeted, entered before/independent of a coaches.id match via coach_id.';
comment on column public.deals.coach_unite is
  'Free-text targeted unit/stock number, used by the ported findCoachMatches duplicate-detection logic.';
comment on column public.deals.niveau_interet is
  'Prospect engagement level, set at first contact. Added for MVP parity with the legacy prototype - not present in the original loki-crm-prod schema.';
comment on column public.deals.montant_final is
  'Signed contract amount, distinct from the proposal value in montant.';

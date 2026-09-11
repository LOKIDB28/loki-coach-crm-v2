-- LOKI Coach CRM v2 - extend loki-crm-prod for MVP field coverage
--
-- This is the exact SQL actually executed against loki-crm-prod (project
-- ref lxujdwlhcsgfsvqrtgfq), confirmed via information_schema.columns.
-- Reconciles the MVP field list in README.md (ported from the legacy
-- loki-coach-crm.jsx prototype) against the real schema, which was built
-- with a proper contacts/deals split and did not carry these per-deal
-- fields. Purely additive: every column is nullable, no default, no
-- check constraint - option lists (niveau_interet, evaluation_client,
-- echange_accidente) are enforced at the app level (src/lib/domain.ts),
-- not by the database.

alter table public.deals
  add column if not exists niveau_interet   text,
  add column if not exists coach_vise       text,
  add column if not exists evaluation_client text,
  add column if not exists date_visite_usine  timestamptz,
  add column if not exists date_essai_routier timestamptz,
  add column if not exists options            text,
  add column if not exists echange_marque     text,
  add column if not exists echange_modele     text,
  add column if not exists echange_annee      text,
  add column if not exists echange_km         text,
  add column if not exists echange_numero_serie text,
  add column if not exists echange_accidente  text,
  add column if not exists date_contrat       date,
  add column if not exists numero_contrat     text,
  add column if not exists date_rdv_service   date;

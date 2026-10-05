-- LOKI Coach CRM v2 - trade-in vehicle maintenance history ("Véhicule en
-- échange", Deal Drawer Section 1, by request from Fred). Purely additive:
-- every column nullable, no default, no check constraint - same house
-- convention as the original echange_* columns
-- (0003_extend_deals_for_mvp.sql: "option lists ... are enforced at the
-- app level, not by the database"), applied here to echange_entretien_
-- travaux too.
--
-- echange_entretien_km is integer, unlike the existing echange_km (text,
-- free-form odometer reading of the trade-in vehicle in general) - this
-- column is specifically the odometer reading at the maintenance event
-- being logged, a real number, not a general/possibly-approximate note.
--
-- Explicitly NOT added here (per request - these fields are undecided,
-- not forgotten): nombre de clés, statut d'inspection, confirmation du
-- solde.

alter table public.deals
  -- date, not timestamptz - same convention as date_contrat/date_rdv_service
  -- (a day, not a specific moment), not date_visite_usine/date_essai_routier
  -- (which do carry a time-of-day, since those are scheduled appointments).
  add column if not exists echange_entretien_date date,
  add column if not exists echange_entretien_km integer,
  -- Fixed small multi-select (changement d'huile, filtre à huile, filtre à
  -- air, freins, autre) - text[] rather than jsonb: no nesting, no need for
  -- anything beyond "is this tag present", and array containment
  -- (`'freins' = any(echange_entretien_travaux)`) is simpler than
  -- unpacking a JSON array for that same check. The 5 known values are a
  -- TypeScript union (src/lib/domain.ts), not a DB check constraint, same
  -- convention as every other option list on this table.
  add column if not exists echange_entretien_travaux text[],
  add column if not exists echange_entretien_notes text;

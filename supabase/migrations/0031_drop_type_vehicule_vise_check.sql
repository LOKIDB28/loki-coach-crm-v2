-- LOKI Coach CRM v2 - deals.type_vehicule_vise becomes app-validated only.
--
-- Why: 0011_add_deal_qualification_fields.sql added
-- `check (type_vehicule_vise in ('neuf', 'usager'))`. The six new vehicle
-- types (Neuf-Bath/Half, Neuf-Bunk, Used, Entertainer - Star Coach,
-- Entertainer - Bunk, Vehicle Special) are stored as stable identifiers
-- listed in TypeScript (lib/domain.ts TYPE_VEHICULE_OPTIONS), by explicit
-- decision with no database constraint - so the old CHECK must go, or the
-- database rejects every new value. Constraint name confirmed by LP on the
-- live database: deals_type_vehicule_vise_check.
--
-- No row is touched. The existing 'neuf' (7) and 'usager' (2) values stay
-- as they are - still displayed and filtered by the app - until LP
-- migrates them by hand.
--
-- HOW TO RUN: block by block, in order, each one ending with its proof
-- query (always returns exactly one row). Run block 2 only after block 1's
-- proof shows contraintes_type_restantes = 0.

-- =========================================================================
-- Block 1. Drop the CHECK constraint.
-- =========================================================================

alter table public.deals drop constraint if exists deals_type_vehicule_vise_check;

-- Proof (one row): expected contraintes_type_restantes = 0.
select
  count(*) filter (where contype = 'c' and pg_get_constraintdef(oid) ilike '%type_vehicule_vise%') as contraintes_type_restantes,
  count(*) as contraintes_sur_deals
from pg_constraint
where conrelid = 'public.deals'::regclass;

-- =========================================================================
-- Block 2. Column comment (documentation only).
-- =========================================================================

comment on column public.deals.type_vehicule_vise is
  'Vehicle type - stable identifier validated in the app only (lib/domain.ts TYPE_VEHICULE_OPTIONS): neuf_bath_half, neuf_bunk, used, entertainer_star_coach, entertainer_bunk, vehicle_special. Legacy neuf/usager still read until migrated by hand. No database constraint since 0031.';

-- Proof (one row): expected a comment starting with 'Vehicle type'.
select col_description(
  'public.deals'::regclass,
  (select attnum from pg_attribute where attrelid = 'public.deals'::regclass and attname = 'type_vehicule_vise')
) as commentaire;

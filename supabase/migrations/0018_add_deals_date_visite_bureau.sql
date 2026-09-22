-- LOKI Coach CRM v2 - "Visite au bureau" as a distinct rendez-vous type
-- from "Visite d'usine" (deals.date_visite_usine, already existing) -
-- confirmed in conversation: real, different security rules apply at the
-- factory, so the two need to stay separately trackable rather than
-- overloading one timestamp column for both. Additive only, same shape as
-- date_visite_usine.

alter table public.deals
  add column if not exists date_visite_bureau timestamptz;

comment on column public.deals.date_visite_bureau is
  'Scheduled office visit - distinct from date_visite_usine (factory visit, different security rules on-site). Set via DealDrawer Section 3.';

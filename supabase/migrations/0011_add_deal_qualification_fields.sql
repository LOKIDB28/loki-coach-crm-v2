-- LOKI Coach CRM v2 - Phase 01: vehicle type + free-text unit fallback.
-- Purely additive, no existing row touched.

alter table public.deals
  add column if not exists type_vehicule_vise text;

alter table public.deals
  add constraint deals_type_vehicule_vise_check
  check (type_vehicule_vise in ('neuf', 'usager'));

comment on column public.deals.type_vehicule_vise is
  'Neuf ou usager - qualification field shown prominently in DealDrawer Section 1, alongside source/niveau_interet.';

alter table public.deals
  add column if not exists numero_unite_libre text;

comment on column public.deals.numero_unite_libre is
  'Free-text unit number fallback for when no inventory coach is linked yet (coach_id is null) - does not replace coach_id, only covers the gap before a real inventory link exists.';

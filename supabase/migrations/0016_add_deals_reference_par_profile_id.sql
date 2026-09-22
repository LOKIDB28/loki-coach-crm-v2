-- LOKI Coach CRM v2 - "Référence interne" as a deal source (Phase 01).
-- When contacts.source = 'Référence interne' (see SOURCE_SUGGESTIONS in
-- src/lib/domain.ts), DealDrawer Section 1 reveals a dropdown to record
-- which internal team member made the referral - a deal-level fact (this
-- specific opportunity was referred by this specific person), not a
-- contact-level one, so it belongs on deals, not contacts, even though
-- "source" itself stays on contacts.source unchanged.

alter table public.deals
  add column if not exists reference_par_profile_id uuid references public.profiles(id);

comment on column public.deals.reference_par_profile_id is
  'Internal team member (profiles.id) who made the referral, set only when contacts.source = ''Référence interne'' - see DealDrawer Section 1. Null otherwise.';

-- No RLS/grant changes needed - deals is already fully governed by the
-- existing is_internal() policies/grants, which apply uniformly to every
-- column including this new one.

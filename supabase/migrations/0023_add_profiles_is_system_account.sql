-- LOKI Coach CRM v2 - explicit, durable exclusion for non-human profiles
-- (e.g. qa-bot@lokicoach.com, the Playwright e2e test account - see
-- scripts/e2e-create-qa-bot.ts) from every rep-selection UI the team sees
-- (DealDrawer's internal-referral picker, NewDealModal's "Représentant"
-- dropdown, RecapTable, RepresentativeTabs). Deliberately NOT inferred
-- from role or from having zero deals assigned - both of those are
-- incidental (a system account could technically be internal-role and
-- could technically end up with a deal by accident), not a real signal
-- that a profile is a person. Additive only.

alter table public.profiles
  add column if not exists is_system_account boolean not null default false;

comment on column public.profiles.is_system_account is
  'True for non-human accounts (e.g. qa-bot, Playwright e2e testing) that must never appear in rep-selection UI, regardless of role or deal assignments. Explicit and durable - not inferred from role or absence of deals.';

update public.profiles set is_system_account = true where email = 'qa-bot@lokicoach.com';

-- LOKI Coach CRM v2 - add deals.archived
--
-- Symmetric to contacts.archived. Replaces the earlier "delete this deal"
-- request (see 0004's header and the README's "no physical deletion"
-- project rule) with a reversible archive flag: archived deals disappear
-- from the default Pipeline view (and every count/recap/dupe-check derived
-- from it) but are never removed from the database, and can be
-- unarchived from the deal drawer at any time.
--
-- Purely additive: nullable-safe default, no existing data touched.

alter table public.deals
  add column if not exists archived boolean not null default false;

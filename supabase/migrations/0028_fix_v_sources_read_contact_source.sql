-- LOKI Coach CRM v2 - v_sources now reads the linked contact's source
-- (contacts.source), falling back to deals.source then 'Inconnue' -
-- NewDealModal/DealDrawer only ever write contacts.source, never
-- deals.source (confirmed via a read-only audit, 2026-10-08): every deal
-- created since this app's launch has deals.source = null, so this view
-- showed "Inconnue" for all of them until now. The ~367 historical deals
-- (pre-dating this app) are the only ones where deals.source was ever
-- populated - hence the fallback stays rather than being dropped.
--
-- CREATE OR REPLACE, not DROP + CREATE: a dropped-and-recreated view loses
-- its own grants (0021 had to re-grant select to authenticated after its
-- own DROP, for exactly this reason) and any other privileges/comments tied
-- to the view's OID - REPLACE keeps the object intact, so none of that
-- needs re-granting here. security_invoker = true is still stated
-- explicitly: REPLACE doesn't carry an option forward from the prior
-- version, it only keeps what you declare again.
--
-- NOT RUN BY THIS MIGRATION FILE ALONE - held for manual, section-by-
-- section execution after comparing against the live view definition. Do
-- not apply via an automated migration runner.

create or replace view public.v_sources
with (security_invoker = true)
as
SELECT COALESCE(c.source, d.source, 'Inconnue'::text) AS source,
    count(*) AS nb_deals,
    count(*) FILTER (WHERE s.code = 'gagne'::text) AS gagnes,
    COALESCE(sum(d.montant) FILTER (WHERE s.code = 'gagne'::text), 0::numeric) AS revenus
   FROM deals d
     JOIN pipeline_stages s ON s.id = d.stage_id
     JOIN contacts c ON c.id = d.contact_id
  GROUP BY COALESCE(c.source, d.source, 'Inconnue'::text)
  ORDER BY (count(*)) DESC;

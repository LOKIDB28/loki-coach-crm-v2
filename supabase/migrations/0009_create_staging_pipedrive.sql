-- LOKI Coach CRM v2 - stage the Pipedrive export (deals-32432855-2.csv, 63
-- rows) for review before any contacts/deals are touched.
--
-- Same spirit as staging_import: a plain landing table, every column text,
-- nothing parsed/typed/linked yet. This migration only creates the table
-- and loads the raw rows - no write to contacts/deals happens here or
-- anywhere until the duplicate-contact review, stage mapping, and owner
-- mapping questions raised alongside this migration are answered.
--
-- stage/contact_person/title are staged byte-for-byte from the source CSV,
-- including a non-breaking space (U+00A0, not a regular space) inside two
-- of the six stage values ("First contact /\xa0exchange", "Visit /\xa0Full
-- Prensentation") - confirmed against the raw file, not assumed. Anything
-- reading stage later normalizes whitespace before comparing rather than
-- relying on this column looking like a clean literal.

create table if not exists public.staging_pipedrive (
  id bigint generated always as identity primary key,
  pipedrive_deal_id text,
  title text,
  value text,
  currency text,
  organization text,
  contact_person text,
  owner text,
  stage text,
  expected_close_date text,
  status text
);

comment on table public.staging_pipedrive is
  'Raw Pipedrive export (deals-32432855-2.csv), landed for review before any contacts/deals writes. Not linked to production tables yet.';

-- No default privilege rule grants SELECT on new public tables to
-- claude_code_ro (checked pg_default_acl before writing this - the read-only
-- role's access to staging_import was a one-time explicit grant, not
-- inherited automatically). Without this, the migration would run but the
-- read-only verification step right after it couldn't see the result.
grant select on public.staging_pipedrive to claude_code_ro;

insert into public.staging_pipedrive
  (pipedrive_deal_id, title, value, currency, organization, contact_person, owner, stage, expected_close_date, status)
values
  ('1', 'Dany Perron Deal', '750000', 'USD', NULL, 'Dany Perron', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('2', '''- Martin Thériault Deal', '800000', 'CAD', NULL, 'Martin Thériault', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('3', 'Denis Desharnais Deal', '2300000', 'USD', NULL, 'Denis Desharnais', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('5', 'Joel Begin Deal', '2500000', 'USD', NULL, 'Joel Begin', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('6', 'Luc Morin Deal', '2300000', 'USD', NULL, 'Luc Morin', 'Pierre-Mathieu Roy', 'Visit / Full Prensentation', NULL, 'Open'),
  ('7', 'Michel Deschamps Deal', '2300000', 'USD', NULL, 'Michel Deschamps', 'Pierre-Mathieu Roy', 'Visit / Full Prensentation', NULL, 'Open'),
  ('8', 'Tom Skudutis Deal', '2300000', 'USD', NULL, 'Tom Skudutis', 'Pierre-Mathieu Roy', 'Proposal sent', NULL, 'Open'),
  ('9', 'Monsieur Asselin Deal', '2000000', 'USD', NULL, 'Monsieur Asselin', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('10', 'Daniel Mercier Deal', '0', 'USD', NULL, 'Daniel Mercier', 'Pierre-Mathieu Roy', 'Proposal sent', NULL, 'Open'),
  ('11', 'François Jacob Deal', '2300000', 'USD', NULL, 'François Jacob', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('12', 'Pierre Benoit Deal', '0', 'CAD', NULL, 'Pierre Benoit', 'Pierre-Mathieu Roy', 'Proposal sent', NULL, 'Open'),
  ('13', 'Michel Blouin Deal', '0', 'CAD', NULL, 'Michel Blouin', 'Pierre-Mathieu Roy', 'Visit / Full Prensentation', NULL, 'Open'),
  ('14', 'André Imbaut Deal', '0', 'CAD', NULL, 'André Imbaut', 'Pierre-Mathieu Roy', 'Visit / Full Prensentation', NULL, 'Open'),
  ('15', 'Russell Laporte Deal', '0', 'CAD', NULL, 'Russell Laporte', 'Pierre-Mathieu Roy', 'Proposal sent', NULL, 'Open'),
  ('16', 'Daniel Lambert Deal', '0', 'CAD', NULL, 'Daniel Lambert', 'Pierre-Mathieu Roy', 'Contract Signed', NULL, 'Open'),
  ('17', 'André Bouchard Deal', '0', 'CAD', NULL, 'André Bouchard', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('18', 'André Tremblay Deal', '0', 'CAD', NULL, 'André Tremblay', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('19', 'William Collick General Manager | BRABUS USA Deal', '0', 'CAD', NULL, 'William Collick General Manager | BRABUS USA', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('20', '''- Gerard Levasseur Deal', '0', 'CAD', NULL, '''- Gerard Levasseur', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('21', 'Dave & Lindsay Atkinson Deal', '0', 'CAD', NULL, 'Dave & Lindsay Atkinson', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('22', 'Marc Thériault Deal', '0', 'CAD', NULL, 'Marc Thériault', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('23', 'Francois Gauthier Deal', '0', 'CAD', NULL, 'Francois Gauthier', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('24', 'Luc Poirier Deal', '5000000', 'CAD', NULL, 'Luc Poirier', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('25', 'Nicolas Hamelin Deal', '0', 'CAD', NULL, 'Nicolas Hamelin', 'Pierre-Mathieu Roy', 'Proposal sent', NULL, 'Open'),
  ('26', 'Vincent brochu Deal', '0', 'CAD', NULL, 'Vincent brochu', 'Pierre-Mathieu Roy', 'Follow-up in process', NULL, 'Open'),
  ('27', 'Alexandre Carrier Deal', '0', 'CAD', NULL, 'Alexandre Carrier', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('28', 'Steeve Poisson Deal', '0', 'CAD', NULL, 'Steeve Poisson', 'Pierre-Mathieu Roy', 'Contract Sent', NULL, 'Open'),
  ('29', 'Lussier Chevrolet', '0', 'CAD', 'Lussier Chevrolet', 'Dominic Lussier', 'Frederick', 'First contact / exchange', '2026-11-20', 'Open'),
  ('30', 'Mcgregor Racing', '0', 'CAD', 'Mcgregor Racing', 'Serge Michaud', 'Frederick', 'First contact / exchange', '2027-03-20', 'Open'),
  ('31', 'Bob Aloi Ultimate RV Deal', '0', 'USD', NULL, 'Bob Aloi Ultimate RV', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('32', 'Michel Leduc Deal', '0', 'CAD', NULL, 'Michel Leduc', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('33', 'Jasmin Leveillé Deal', '0', 'CAD', NULL, 'Jasmin Leveillé', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('34', 'Frederic Lafleur Deal', '0', 'CAD', NULL, 'Frederic Lafleur', 'Pierre-Mathieu Roy', 'Visit / Full Prensentation', NULL, 'Open'),
  ('35', 'Michael et Kelly', '0', 'CAD', NULL, 'Michael et Kelly', 'Frederick', 'First contact / exchange', '2027-04-01', 'Open'),
  ('36', 'John Hager Deal', '0', 'CAD', NULL, 'John Hager', 'Pierre-Mathieu Roy', 'Contract Sent', NULL, 'Open'),
  ('37', 'Dominique Turcotte', '2000000', 'CAD', NULL, 'Dominique Turcotte', 'Frederick', 'First contact / exchange', '2027-01-28', 'Open'),
  ('38', 'Mme Lemieux', '3800000', 'CAD', NULL, 'Gilles Bourdeau', 'Frederick', 'Contract Signed', '2026-09-02', 'Open'),
  ('39', 'Jean-Louis Bellemare', '0', 'CAD', NULL, 'Jean-Louis Bellemare', 'Frederick', 'First contact / exchange', '2026-09-03', 'Open'),
  ('40', 'Jean-Louis Bellemare', '0', 'CAD', NULL, 'Jean-Louis Bellemare', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('41', 'Andre Bouchard', '0', 'CAD', NULL, 'Andre Bouchard', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('42', 'Dave /Lidsay atkinson duglas', '0', 'CAD', NULL, 'Dave /Lidsay atkinson duglas', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('43', 'Mario Charrette', '0', 'CAD', NULL, 'Mario Charrette', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('44', 'Matthew Teudor', '0', 'CAD', NULL, 'Matthew Teudor', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('45', 'Nicolas Lemelin', '0', 'CAD', NULL, 'Nicolas Lemelin', 'Jeff Gagne', 'Proposal sent', NULL, 'Open'),
  ('46', 'Stephane Boudrias', '0', 'CAD', NULL, 'Stephane Boudrias', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('47', 'Tom Skudutis', '0', 'CAD', NULL, 'Tom Skudutis', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('48', 'Alex Palou', '0', 'CAD', NULL, 'Alex Palou', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('49', 'Bobby Rahal', '0', 'CAD', NULL, 'Bobby Rahal', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('50', 'Graham Rahal', '0', 'CAD', NULL, 'Graham Rahal', 'Jeff Gagne', 'First contact / exchange', '2026-08-30', 'Open'),
  ('51', 'Thomas E. Boehland', '0', 'CAD', NULL, 'Thomas E. Boehland', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('52', 'Mick Schumacher', '0', 'CAD', NULL, 'Mick Schumacher', 'Jeff Gagne', 'Proposal sent', NULL, 'Open'),
  ('53', 'Jason Dixon', '0', 'CAD', NULL, 'Jason Dixon', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('54', 'Joel', '0', 'CAD', NULL, 'Joel', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('55', 'Andre Perron', '0', 'CAD', NULL, 'Andre Perron', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('56', 'François Jacob', '0', 'CAD', NULL, 'François Jacob', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('57', 'Russel Laporte', '0', 'CAD', NULL, 'Russel Laporte', 'Jeff Gagne', 'First contact / exchange', NULL, 'Open'),
  ('58', 'Joel Brassard Deal', '0', 'CAD', NULL, 'Joel Brassard', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('59', 'Eric Fradette Deal', '0', 'CAD', NULL, 'Eric Fradette', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open'),
  ('60', 'Lake erie Shores', '1500000', 'USD', 'Lake erie Shores', 'Juan Estrada', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('61', 'Jim Tharp', '700000', 'USD', NULL, 'Jim Tharp', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('62', 'Lake erie shore', '1700000', 'USD', 'Lake erie shore', 'John Richardson', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('63', 'Lake erie shore  #63', '2000000', 'USD', 'Lake erie shore  #63', 'M.63', 'Frederick', 'First contact / exchange', NULL, 'Open'),
  ('64', 'F1 Paddock Supplier Deal', '1100000', 'USD', 'F1 Paddock Supplier', 'Carl', 'Pierre-Mathieu Roy', 'First contact / exchange', NULL, 'Open');

# LOKI Coach CRM v2

Rebuild of the internal sales/service pipeline tool for LOKI Coach (luxury
Prévost motorcoaches, Quebec) as a real Next.js + Supabase application,
replacing the React prototype that ran on an ephemeral shared key-value
store with no real authentication.

Same pipeline concepts and French Québécois labels as the prototype — now
backed by a real production Postgres project (**loki-crm-prod**, ref
`lxujdwlhcsgfsvqrtgfq`, `ca-central-1`), real auth, and Row Level Security,
deployable to Vercel. A clean, Apple-inspired visual design replaces the
prototype's original dark-brass look (see "Design" below).

**This app is connected to a pre-existing production project, not a fresh
one.** `loki-crm-prod` already held 364 contacts / 369 deals with its own
schema (a proper `contacts`/`deals` split, `pipeline_stages`, `coaches`,
`tasks`) before this codebase existed — see "Data model" for how the two
were reconciled.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase**: Postgres + Auth (magic link) + Row Level Security
- No Supabase Storage, no file attachments, no native app — a responsive
  web app usable from phone, tablet, or laptop.

## Getting started

This app targets the existing **loki-crm-prod** project — there is no
fresh Supabase project to create.

1. **Apply the three migrations** in the `loki-crm-prod` Supabase SQL editor:
   - `supabase/migrations/0003_extend_deals_for_mvp.sql` — adds nullable
     columns to `deals` (never touches existing data) to cover MVP fields
     the original prod schema didn't have yet (niveau d'intérêt, évaluation
     client, dates par étape, contrat, véhicule d'échange). See that file's
     header comment for the full list.
   - `supabase/migrations/0004_grant_authenticated_privileges.sql` — the
     `authenticated` role had RLS policies but no base table `GRANT`s, so
     every signed-in query fails with `permission denied for table X` until
     this runs. See that file's header comment for how this was diagnosed.
   - `supabase/migrations/0005_add_deals_archived.sql` — adds
     `deals.archived boolean not null default false`, symmetric to
     `contacts.archived`. Powers the "Archiver ce dossier" action.

   `supabase/migrations/0001_init.sql` is kept only as historical
   documentation of the scaffold's original (never-deployed) schema design
   — it is not run against `loki-crm-prod`.
2. **Confirm the auth bootstrap trigger**: `loki-crm-prod` already has an
   `on_auth_user_created` trigger on `auth.users` that creates a
   `public.profiles` row (`role = 'internal'`) on first sign-in — verify it
   still exists before onboarding the team (`select tgname from pg_trigger
   where tgname = 'on_auth_user_created'` in the SQL editor).
3. **Enable email (magic link) auth**: in Supabase Dashboard → Authentication
   → Providers, make sure Email is enabled. Under Authentication → URL
   Configuration, add your local dev URL (`http://localhost:3000/auth/callback`)
   and your production URL (`https://your-app.vercel.app/auth/callback`) as
   Redirect URLs.
4. **Invite the team**: the team's accounts each sign in once via the
   `/login` page with their email — this auto-creates their `profiles` row
   via the trigger. Afterwards, open Supabase → Table editor → `profiles`
   and set each person's `nom` to their display name (e.g. "Jeff Gagné") so
   it renders correctly in the representative tabs and dropdowns instead of
   falling back to their email's local part.
5. **Copy env vars**: `.env.local` is already set up with
   `NEXT_PUBLIC_SUPABASE_URL` pointing at `loki-crm-prod`
   (`https://lxujdwlhcsgfsvqrtgfq.supabase.co`) — fill in
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` from that project's Project Settings →
   API → Project API keys → `anon` `public`.
6. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Visit `http://localhost:3000`, sign in with a magic link, and you're in.
7. **Deploy to Vercel**: import the repo, set the same two `NEXT_PUBLIC_*`
   env vars in the Vercel project settings, and deploy. Add the deployed
   URL's `/auth/callback` to `loki-crm-prod`'s redirect URL allow-list.

**Note on `scripts/migrate-from-json.ts`**: this one-time cutover script
was written against the scaffold's original single-table `clients` schema
and has not been updated for the real `contacts`/`deals` split — the actual
cutover from the legacy prototype into `loki-crm-prod` (364 contacts, 369
deals) already happened through a separate process before this codebase
was connected to it. Treat this script as historical/unused rather than
running it again.

## Design

Apple-inspired clean visual language (see `src/lib/theme.ts` and
`tailwind.config.ts`), light by default with an automatic dark mode via
`prefers-color-scheme`. Fixed brand palette — do not introduce other hues:

- **Vivid Teal `#00A660`** — accent principal, boutons, liens actifs
- **Onyx `#111111`** — texte / fond sombre (dark mode)
- **Paper White `#FFFFFF` / `#F9F9F9`** — cartes, fond clair
- **Stone Gray `#6B7280`** — texte secondaire
- **Vivid Green `#A6FA30`** — accent rare (alertes positives) — parcimonie

System font stack (no web font load), per Apple's own typography guidance.

## One-time data migration from the prototype

The old prototype exported its data as a JSON array of client objects
(camelCase fields, e.g. `prenom`, `coachNeufVise`, `notesProposition` —
see `emptyClient()` in the legacy `loki-coach-crm.jsx`). To bring that data
into Supabase:

```bash
# 1. Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Project Settings -> API
#    -> service_role secret). This bypasses RLS for the one-time import -
#    never commit it or expose it to the browser.

# 2. Dry run first (default - prints a summary, writes nothing):
npx tsx scripts/migrate-from-json.ts path/to/export.json

# 3. Review the summary: total clients, total activities, and any
#    représentant names that didn't match an existing profiles.nom (those
#    import with owner_id = null and need manual reassignment afterwards).

# 4. When it looks right, commit the import:
npx tsx scripts/migrate-from-json.ts path/to/export.json --commit
```

The script maps each of the prototype's six per-stage free-text note
fields (`notes1`, `followUpNotes`, `notesVisite`, `notesProposition`,
`notesContrat`, `notesService`) to a row in `activities`, backdated to the
client's original `createdAt` timestamp (no more precise historical
timestamp exists in the source data). After a real (`--commit`) run, the
script prints how many clients/activities were actually inserted — compare
that client count against the source JSON's client count as your cutover
validation step before retiring the old prototype.

**This import script is a one-time cutover tool, not a recurring feature.**
There is deliberately no "Import" button in the app UI — only the
permanent **Exporter** button (a standing JSON backup of every client and
every activity), per the migration mandate.

## Data model

`loki-crm-prod`'s real schema, extended by
`supabase/migrations/0003_extend_deals_for_mvp.sql` (see that file's header
for the exact list of added columns):

- **`profiles`** — one row per team member (Supabase Auth user), with a
  `role` (`admin`/`internal`/`client`) checked by the `is_internal()` RLS
  helper. Bootstrapped by the `on_auth_user_created` trigger on first
  sign-in. Replaces the prototype's hardcoded `REPRESENTANTS` array.
- **`contacts`** — the person/company: name, phone, email, address, source,
  canal. A contact can have more than one `deal` over time (the prototype's
  single-table model assumed one-to-one).
- **`deals`** — the pipeline itself: `contact_id`, `stage_id` (→
  `pipeline_stages`), `owner_id`, amounts, and the per-stage structured
  fields added by the 0003 migration (provenance/intérêt now live on the
  contact or deal — see the migration file). Mirrors the prototype's
  `emptyClient()` shape as closely as the real schema allows.
- **`pipeline_stages`** — 7 stages (`prospect`, `contact`, `rencontre`,
  `proposition`, `negociation`, `gagne`, `perdu`), each with a `label` and a
  `probability` — a real lookup table, not a hardcoded array. The
  prototype's 6-stage model maps onto this with `gagne`/`perdu` as the two
  closed states.
- **`coaches`** — real vehicle inventory (`unit_number`, `statut`), linked
  from `deals.coach_id`. Not managed by this app (no create/edit UI) — only
  surfaced as a read-only picker on a deal.
- **`activities`** — an append-only note/history feed, linked to a
  `contact_id` and/or `deal_id`. Types are channel-based (`note`, `appel`,
  `courriel`, `texto`, `rencontre`, `changement_etape`, `autre`) rather than
  per-stage as in the original scaffold design — notes added from the deal
  drawer use `type = 'note'`. `changement_etape` rows are auto-inserted by
  a `deals_log_stage` DB trigger, not by the app.
- **`tasks`**, **`staging_import`** — exist in `loki-crm-prod` but are not
  used by this app (no UI reads or writes them).

**Row Level Security**: every authenticated internal user (`is_internal()`)
can read and write `contacts`/`deals`/`activities` — matching the
prototype's whole-team-sees-everything behavior. `profiles` are readable by
everyone internal but only editable by their own owner.

## Functional coverage (MVP scope)

- Create/read/update on contacts/deals, all fields from the prototype
  (reconciled against the real schema — see "Data model"). **No delete,
  anywhere in the app** — project rule: no physical deletion of contacts,
  deals, or tasks. `authenticated` has no DELETE grant on any table (see
  `0004_grant_authenticated_privileges.sql`) — enforced at the database
  level, not only in app code. `deals.archived` (symmetric to
  `contacts.archived`) backs an "Archiver ce dossier" action in the deal
  drawer (with confirmation) and a "Désarchiver" one-click undo; archived
  deals are excluded from every pipeline view/count/recap/dupe-check by
  default, toggled back in via "Afficher les dossiers archivés".
- Explicit close-out: "Marquer gagné" / "Marquer perdu" buttons in the deal
  drawer set `stage_id` directly to the closed stage regardless of the
  deal's current stage, with confirmation. The stage stepper's ◀▶ arrows
  only move within the 5 open stages (driven by `pipeline_stages.is_open`)
  and never reach `gagne`/`perdu` as a side effect. Neither button is
  disabled by the deal's current state — a "perdu" deal can always be
  reopened as "gagné" later.
- Pipeline bar (counts per stage, click to filter, live from
  `pipeline_stages`) and a stage stepper in the deal detail drawer.
- Chronological, newest-first activity feed per deal (notes + stage
  changes), with author and timestamp.
- "Suivis à faire" tab: deals with a `next_action_at`, sorted soonest
  first, with a red/warning treatment on anything overdue.
- `owner_id` (on the deal) assignable to any team member via a dropdown
  sourced from `profiles` — no hardcoded rep list anywhere.
- Duplicate detection ported byte-for-byte in logic from the prototype's
  `findClientMatches` / `findCoachMatches`: exact case-insensitive match on
  phone/email/full name flags the same person entered twice; exact
  case-insensitive match on the targeted unit/stock number or new-coach
  description flags two reps chasing the same physical unit. Shown as
  warning banners on cards, in the new-client form, and in the detail
  drawer.
- Recap table (owner × niveau d'intérêt, with totals), computed live from
  whatever's currently loaded.
- Standing JSON export of all contacts + deals + activities (permanent
  backup feature, not a one-time migration tool).

**Explicitly out of scope for this MVP** (per the mandate — do not add):
per-rep row-level restrictions, multi-role permissions, email/SMS
automation, a native mobile app or PWA install flow, BI beyond the recap
table, multi-tenancy, coach-inventory management UI, and a recurring
"Import" UI.

## Project structure

```
loki-coach-crm-v2/
  supabase/migrations/0001_init.sql          Historical only - scaffold's original schema, never run
  supabase/migrations/0003_extend_deals_for_mvp.sql  Additive migration actually run against loki-crm-prod
  scripts/migrate-from-json.ts               Historical only - written for the 0001 schema, not the real one
  src/middleware.ts                          Redirects unauthenticated users to /login
  src/lib/
    supabase/client.ts                Browser Supabase client
    supabase/server.ts                Server Component / Route Handler client
    theme.ts                          Brand palette + font stack
    domain.ts                         Stage icons, option lists, dupe-detection logic
    format.ts                         fr-CA date/currency formatting helpers
    data.ts                           Supabase query/mutation functions
    types.ts                          Hand-written types matching the real schema
  src/components/                     DealCard, DealDrawer, NewDealModal, PipelineBar, etc.
  src/components/ui/                  Field, TextInput, TextArea, Select, CurrencyInput
  src/app/
    page.tsx                          Main dashboard (client component)
    login/page.tsx                    Magic-link request form
    auth/callback/route.ts            Magic-link callback -> session cookie -> redirect
```

## Known limitations / not verified

Verified so far: typecheck, lint, and production build all pass; the
`/login` ↔ `/` auth redirect was exercised end-to-end against
`loki-crm-prod` (confirming `src/middleware.ts` actually runs — it was
originally placed at the project root, where Next.js silently ignores it
given this project's `src/` layout; moved during this work). Not yet
verified: a real magic-link sign-in and the RLS policies under an
authenticated session (blocked on the `anon` key and the 0003 migration
being applied) — the `handle_new_user`-equivalent trigger, the RLS
policies as written, and the
magic-link redirect flow end to end.

## Dette technique / à faire

- **Grouper par intérêt masqué le 2026-09-15** — à réactiver une fois que
  `niveau_interet` est rempli sur un nombre significatif de deals (seuil
  suggéré : au moins 15-20% des deals actifs). Au moment du masquage, un
  seul deal sur 370 avait ce champ rempli, donc cocher la case ne
  produisait presque aucun effet visible. Code non supprimé — le contrôle
  (`src/app/page.tsx`) est gardé derrière une constante
  `SHOW_GROUP_BY_INTEREST = false`, à repasser à `true` pour le
  réactiver.

## Conversions de devises appliquées

L'import Pipedrive (`deals-32432855-2.csv`, 63 deals) contenait des montants
en deux devises (`Deal - Currency of Value`: 48 CAD, 15 USD), alors que
`deals.montant` n'a aucune colonne devise — tout y est écrit comme un seul
nombre. Les 15 deals en USD ont été convertis en CAD avant l'écriture,
plutôt que laissés tels quels.

- **Taux utilisé** : 1 USD = 1.39 CAD
- **Date de vérification du taux** : 16 septembre 2026
- **Source** : taux du marché interbancaire (mid-market), vérifié via une
  recherche web au moment de l'import — pas un taux historique à la date de
  transaction de chaque deal individuel, qui n'est pas connue.
- **Ce que ça veut dire pour un audit futur** : si quelqu'un doit un jour
  corriger ces montants avec le vrai taux du jour de la transaction plutôt
  que le taux d'import, les 15 deals ci-dessous sont ceux à retrouver et
  recalculer (montant USD d'origine ÷ 1.39 pour retrouver la valeur source,
  puis reconvertir au taux historique correct) :

| Deal Pipedrive (ID) | Contact | Valeur USD d'origine |
|---|---|---|
| 1 | Dany Perron | 750 000 |
| 3 | Denis Desharnais | 2 300 000 |
| 5 | Joel Begin | 2 500 000 |
| 6 | Luc Morin | 2 300 000 |
| 7 | Michel Deschamps | 2 300 000 |
| 8 | Tom Skudutis | 2 300 000 |
| 9 | Monsieur Asselin | 2 000 000 |
| 10 | Daniel Mercier | 0 *(→ montant NULL, pas converti)* |
| 11 | François Jacob | 2 300 000 |
| 31 | Bob Aloi Ultimate RV | 0 *(→ montant NULL, pas converti)* |
| 60 | Juan Estrada | 1 500 000 |
| 61 | Jim Tharp | 700 000 |
| 62 | John Richardson | 1 700 000 |
| 63 | M.63 | 2 000 000 |
| 64 | Carl | 1 100 000 |

Les IDs Pipedrive ci-dessus sont aussi préservés dans
`staging_pipedrive.pipedrive_deal_id` et dans le commentaire de la
migration qui écrit ces deals dans `deals` - la table de correspondance
exacte reste disponible même après que cette section soit périmée.


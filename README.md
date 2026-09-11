# LOKI Coach CRM v2

Rebuild of the internal sales/service pipeline tool for LOKI Coach (luxury
Prévost motorcoaches, Quebec) as a real Next.js + Supabase application,
replacing the React prototype that ran on an ephemeral shared key-value
store with no real authentication.

Same pipeline, same fields, same dark-brass look and French Québécois
labels as the prototype — now backed by Postgres, real auth, and Row Level
Security, deployable to Vercel.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase**: Postgres + Auth (magic link) + Row Level Security
- No Supabase Storage, no file attachments, no native app — a responsive
  web app usable from phone, tablet, or laptop.

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the migration**: in the Supabase SQL editor, paste and run
   `supabase/migrations/0001_init.sql`. This creates the `profiles`,
   `clients`, and `activities` tables, all RLS policies, and the trigger
   that auto-creates a `profiles` row when someone signs in for the first
   time.
3. **Enable email (magic link) auth**: in Supabase Dashboard → Authentication
   → Providers, make sure Email is enabled. Under Authentication → URL
   Configuration, add your local dev URL (`http://localhost:3000/auth/callback`)
   and your production URL (`https://your-app.vercel.app/auth/callback`) as
   Redirect URLs.
4. **Invite the team**: the four accounts (Jeff, Pierre-Mathieu, Frederick,
   LP) each sign in once via the `/login` page with their email — this
   auto-creates their `profiles` row via the trigger. Afterwards, open
   Supabase → Table editor → `profiles` and set each person's `nom` to
   their display name (e.g. "Jeff Gagné") so it renders correctly in the
   representative tabs and dropdowns instead of falling back to their
   email's local part.
5. **Copy env vars**: `cp .env.local.example .env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   Project Settings → API. (`SUPABASE_SERVICE_ROLE_KEY` is only needed for
   the one-time migration script below — never expose it to the browser.)
6. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Visit `http://localhost:3000`, sign in with a magic link, and you're in.
7. **Deploy to Vercel**: import the repo, set the same three env vars in
   the Vercel project settings (skip the service role key unless you plan
   to run the migration script from a Vercel-adjacent environment), and
   deploy. Add the deployed URL's `/auth/callback` to Supabase's redirect
   URL allow-list.

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

Three tables (see `supabase/migrations/0001_init.sql` for the authoritative
definition):

- **`profiles`** — one row per team member (Supabase Auth user). Replaces
  the prototype's hardcoded `REPRESENTANTS` array: any client's
  `owner_id` can be assigned to any profile via a live dropdown.
- **`clients`** — the pipeline itself: contact info, stage (1–6), and the
  per-stage structured fields (provenance, coach targeted, trade-in
  vehicle, pricing, contract, service appointment, etc). Mirrors the
  prototype's `emptyClient()` shape, translated to snake_case.
- **`activities`** — an append-only note/history feed per client. Replaces
  the prototype's six free-text note fields (one per stage) with proper
  rows: `note_premier_contact`, `note_suivi`, `note_visite`,
  `note_proposition`, `note_contrat`, `note_service`, plus
  `changement_etape` (auto-logged on every stage change) and `autre`.
  Notes are never edited or deleted in place — a correction is a new row,
  so the feed is a true, tamper-evident history of the deal.

**Row Level Security**: every authenticated user can read and write every
row in `clients` and `activities` — this intentionally matches the
prototype's current no-restriction, whole-team-sees-everything behavior.
`profiles` rows are readable by everyone (needed for dropdowns/authorship)
but only editable by their own owner.

## Functional coverage (MVP scope)

- Full CRUD on clients/prospects, all fields from the prototype.
- The same 6-stage pipeline bar (counts per stage, click to filter) and a
  stage stepper in the client detail drawer.
- Chronological, newest-first activity feed per client (notes + stage
  changes), with author and timestamp.
- "Suivis à faire" tab: clients with a follow-up date, sorted soonest
  first, with a red/warning treatment on anything overdue.
- `owner_id` assignable to any team member via a dropdown sourced from
  `profiles` — no hardcoded rep list anywhere.
- Duplicate detection ported byte-for-byte in logic from the prototype's
  `findClientMatches` / `findCoachMatches`: exact case-insensitive match on
  phone/email/full name flags the same person entered twice; exact
  case-insensitive match on the targeted unit/stock number or new-coach
  description flags two reps chasing the same physical unit. Shown as
  warning banners on cards, in the new-client form, and in the detail
  drawer.
- Recap table (owner × niveau d'intérêt, with totals), computed live from
  whatever's currently loaded.
- Standing JSON export of all clients + all activities (permanent backup
  feature, not a one-time migration tool).

**Explicitly out of scope for this MVP** (per the mandate — do not add):
per-rep row-level restrictions, multi-role permissions, email/SMS
automation, a native mobile app or PWA install flow, BI beyond the recap
table, multi-tenancy, and a recurring "Import" UI (only the one-time
script above).

## Project structure

```
loki-coach-crm-v2/
  supabase/migrations/0001_init.sql   Full schema + RLS + auth trigger
  scripts/migrate-from-json.ts        One-time cutover script (see above)
  middleware.ts                       Redirects unauthenticated users to /login
  src/lib/
    supabase/client.ts                Browser Supabase client
    supabase/server.ts                Server Component / Route Handler client
    theme.ts                          COLORS + font stack, ported from the prototype
    domain.ts                         STAGES/PROVENANCES/INTERETS/etc + dupe-detection logic
    format.ts                         fr-CA date/currency formatting helpers
    data.ts                           Supabase query/mutation functions
    types.ts                          Hand-written types matching the schema
  src/components/                     ClientCard, PipelineBar, ClientDrawer, etc.
  src/components/ui/                  Field, TextInput, TextArea, Select, CurrencyInput
  src/app/
    page.tsx                          Main dashboard (client component)
    login/page.tsx                    Magic-link request form
    auth/callback/route.ts            Magic-link callback -> session cookie -> redirect
```

## Known limitations / not verified

There was no live Supabase project available while building this, so the
code type-checks and the dependency tree resolves, but none of the
Supabase calls, RLS policies, or the auth flow have been exercised against
a real backend. Test thoroughly against a real (ideally staging) Supabase
project before pointing the team at this in production — in particular:
the `handle_new_user` trigger, the RLS policies as written, and the
magic-link redirect flow end to end.

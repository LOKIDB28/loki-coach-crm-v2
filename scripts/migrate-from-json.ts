/**
 * One-time migration: imports a JSON export from the legacy loki-coach-crm.jsx
 * prototype (an array of client objects using the prototype's camelCase
 * emptyClient() field names) into the new Supabase schema.
 *
 * Usage:
 *   npx tsx scripts/migrate-from-json.ts <path-to-export.json>            # dry run (default)
 *   npx tsx scripts/migrate-from-json.ts <path-to-export.json> --dry-run  # explicit dry run
 *   npx tsx scripts/migrate-from-json.ts <path-to-export.json> --commit  # actually writes
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (or a .env.local file in the project root - loaded
 * automatically). The service role key is required because this script
 * bypasses RLS to perform a bulk one-time import; never ship it to the
 * browser or commit it to source control.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

// ---------------------------------------------------------------------------
// Legacy prototype shape (camelCase), per emptyClient() in loki-coach-crm.jsx
// ---------------------------------------------------------------------------
interface LegacyClient {
  id?: string;
  createdAt?: string;
  stage?: number;
  typeClient?: string;
  representant?: string;
  prenom?: string;
  nom?: string;
  telephone?: string;
  email?: string;
  ville?: string;
  codePostal?: string;
  provenance?: string;
  niveauInteret?: string;
  coachNeufVise?: string;
  coachUnite?: string;
  notes1?: string;
  coachMarque?: string;
  coachModele?: string;
  coachAnnee?: string;
  coachKm?: string;
  coachAccidente?: string;
  followUpDate?: string;
  followUpNotes?: string;
  evaluationClient?: string;
  visiteUsineDate?: string;
  essaiRoutierDate?: string;
  notesVisite?: string;
  prixVente?: number | string;
  options?: string;
  echangeDescription?: string;
  echangeNumeroSerie?: string;
  echangeValeur?: number | string;
  notesProposition?: string;
  dateContrat?: string;
  numeroContrat?: string;
  montantFinal?: number | string;
  notesContrat?: string;
  dateRdvService?: string;
  notesService?: string;
}

interface LegacyProfileLookup {
  id: string;
  nom: string | null;
}

interface NoteFieldSpec {
  legacyField: keyof LegacyClient;
  activityType: string;
}

// Maps each of the six legacy per-stage free-text note fields to the
// activities.type it becomes, per the migration mandate.
const NOTE_FIELDS: NoteFieldSpec[] = [
  { legacyField: "notes1", activityType: "note_premier_contact" },
  { legacyField: "followUpNotes", activityType: "note_suivi" },
  { legacyField: "notesVisite", activityType: "note_visite" },
  { legacyField: "notesProposition", activityType: "note_proposition" },
  { legacyField: "notesContrat", activityType: "note_contrat" },
  { legacyField: "notesService", activityType: "note_service" },
];

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const commit = argv.includes("--commit");
  const explicitDryRun = argv.includes("--dry-run");
  return {
    filePath: positional[0],
    dryRun: explicitDryRun || !commit,
  };
}

function toNumberOrNull(v: number | string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOnlyOrNull(v: string | undefined): string | null {
  const iso = toIsoOrNull(v);
  return iso ? iso.slice(0, 10) : null;
}

async function main() {
  const { filePath, dryRun } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    console.error("Usage: tsx scripts/migrate-from-json.ts <path-to-export.json> [--dry-run|--commit]");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment / .env.local."
    );
    process.exit(1);
  }

  const raw = await readFile(resolve(process.cwd(), filePath), "utf-8");
  const parsed: unknown = JSON.parse(raw);
  const legacyClients: LegacyClient[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { clients?: LegacyClient[] })?.clients)
    ? (parsed as { clients: LegacyClient[] }).clients
    : [];

  if (legacyClients.length === 0) {
    console.error(
      "No clients found in the given file. Expected either a JSON array of client objects, " +
        "or an object with a `clients` array."
    );
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, nom");
  if (profileError) {
    console.error("Failed to load profiles:", profileError.message);
    process.exit(1);
  }
  const profiles = (profileRows ?? []) as LegacyProfileLookup[];
  const profileByLowerNom = new Map(
    profiles.filter((p) => p.nom).map((p) => [p.nom!.trim().toLowerCase(), p.id])
  );

  const unmatchedRepresentants: string[] = [];
  let plannedActivityCount = 0;

  const clientInserts: Record<string, unknown>[] = [];
  const activityPlans: {
    clientIndex: number;
    type: string;
    contenu: string;
    createdAt: string | null;
  }[] = [];

  legacyClients.forEach((lc, index) => {
    const stage = typeof lc.stage === "number" && lc.stage >= 1 && lc.stage <= 6 ? lc.stage : 1;
    const typeClient = lc.typeClient === "Concessionnaire" ? "Concessionnaire" : "Particulier";

    let ownerId: string | null = null;
    const repName = (lc.representant ?? "").trim();
    if (repName) {
      const match = profileByLowerNom.get(repName.toLowerCase());
      if (match) {
        ownerId = match;
      } else {
        unmatchedRepresentants.push(`${lc.prenom ?? ""} ${lc.nom ?? ""} (représentant: "${repName}")`.trim());
      }
    }

    const createdAt = toIsoOrNull(lc.createdAt) ?? undefined;

    clientInserts.push({
      // created_at is preserved from the legacy export when parseable, to
      // keep original pipeline timing intact after cutover; omitted (falls
      // back to the column default: now()) when missing/unparseable.
      ...(createdAt ? { created_at: createdAt } : {}),
      stage,
      type_client: typeClient,
      owner_id: ownerId,
      prenom: lc.prenom ?? null,
      nom: lc.nom ?? null,
      telephone: lc.telephone ?? null,
      email: lc.email ?? null,
      ville: lc.ville ?? null,
      code_postal: lc.codePostal ?? null,
      provenance: lc.provenance ?? null,
      niveau_interet: lc.niveauInteret ?? null,
      coach_neuf_vise: lc.coachNeufVise ?? null,
      coach_unite: lc.coachUnite ?? null,
      coach_marque: lc.coachMarque ?? null,
      coach_modele: lc.coachModele ?? null,
      coach_annee: lc.coachAnnee ?? null,
      coach_km: lc.coachKm ?? null,
      coach_accidente: lc.coachAccidente ?? null,
      follow_up_date: toIsoOrNull(lc.followUpDate),
      evaluation_client: lc.evaluationClient ?? null,
      visite_usine_date: toIsoOrNull(lc.visiteUsineDate),
      essai_routier_date: toIsoOrNull(lc.essaiRoutierDate),
      prix_vente: toNumberOrNull(lc.prixVente),
      options: lc.options ?? null,
      echange_description: lc.echangeDescription ?? null,
      echange_numero_serie: lc.echangeNumeroSerie ?? null,
      echange_valeur: toNumberOrNull(lc.echangeValeur),
      date_contrat: toDateOnlyOrNull(lc.dateContrat),
      numero_contrat: lc.numeroContrat ?? null,
      montant_final: toNumberOrNull(lc.montantFinal),
      date_rdv_service: toDateOnlyOrNull(lc.dateRdvService),
    });

    for (const spec of NOTE_FIELDS) {
      const value = lc[spec.legacyField];
      if (typeof value === "string" && value.trim() !== "") {
        plannedActivityCount += 1;
        activityPlans.push({
          clientIndex: index,
          type: spec.activityType,
          contenu: value.trim(),
          createdAt: createdAt ?? null,
        });
      }
    }
  });

  console.log("--- LOKI Coach CRM: migration from JSON export ---");
  console.log(`Source file: ${filePath}`);
  console.log(`Clients found in export: ${legacyClients.length}`);
  console.log(`Clients to insert: ${clientInserts.length}`);
  console.log(`Activities to create (from legacy note fields): ${plannedActivityCount}`);
  console.log(`Unmatched représentant names: ${unmatchedRepresentants.length}`);
  if (unmatchedRepresentants.length > 0) {
    console.log("  These clients will import with owner_id = null. Fix manually afterwards:");
    for (const line of unmatchedRepresentants) console.log(`    - ${line}`);
  }

  if (dryRun) {
    console.log("\nDRY RUN - no data was written. Re-run with --commit to perform the import.");
    return;
  }

  console.log("\nCommitting import...");

  let clientsInserted = 0;
  let activitiesInserted = 0;
  const insertedClientIds: string[] = [];

  for (let i = 0; i < clientInserts.length; i++) {
    const row = clientInserts[i];
    if (!row) continue;
    const { data, error } = await supabase
      .from("clients")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error(`Failed to insert client at index ${i}:`, error.message);
      insertedClientIds.push("");
      continue;
    }
    insertedClientIds.push((data as { id: string }).id);
    clientsInserted += 1;
  }

  for (const plan of activityPlans) {
    const clientId = insertedClientIds[plan.clientIndex];
    if (!clientId) continue; // client insert failed - skip its notes
    const { error } = await supabase.from("activities").insert({
      client_id: clientId,
      type: plan.type,
      contenu: plan.contenu,
      created_by: null,
      ...(plan.createdAt ? { created_at: plan.createdAt } : {}),
    });
    if (error) {
      console.error(`Failed to insert activity (${plan.type}) for client index ${plan.clientIndex}:`, error.message);
      continue;
    }
    activitiesInserted += 1;
  }

  console.log("\n--- Import summary ---");
  console.log(`clients inserted: ${clientsInserted} / ${clientInserts.length}`);
  console.log(`activities inserted: ${activitiesInserted} / ${plannedActivityCount}`);
  console.log(
    `Compare "clients inserted" above against the source export's client count (${legacyClients.length}) to validate the cutover.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

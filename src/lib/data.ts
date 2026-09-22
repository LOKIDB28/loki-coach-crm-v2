import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  ActivityWithAuthor,
  Coach,
  Contact,
  Deal,
  DealPhoto,
  DealWithContact,
  ExchangeRateWithAuthor,
  ForecastByRepRow,
  NewContact,
  PipelineStage,
  Profile,
  SourceBreakdownRow,
} from "./types";

export async function fetchProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nom, email, role, created_at")
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchPipelineStages(supabase: SupabaseClient): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PipelineStage[];
}

export async function fetchCoaches(supabase: SupabaseClient): Promise<Coach[]> {
  const { data, error } = await supabase
    .from("coaches")
    .select("*")
    .order("unit_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Coach[];
}

export async function fetchDeals(supabase: SupabaseClient): Promise<DealWithContact[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("*, contact:contacts(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DealWithContact[];
}

export async function fetchActivitiesForDeal(
  supabase: SupabaseClient,
  dealId: string
): Promise<ActivityWithAuthor[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*, author:profiles(id, nom, email, role, created_at)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ActivityWithAuthor[];
}

/**
 * Creates a contact and its first deal together (the "Nouveau client" flow -
 * every new prospect enters the pipeline at stage 1 via a deal). Two
 * sequential inserts, not atomic - acceptable at this team's scale, same
 * tradeoff the prototype made for stage-change logging.
 */
export async function createContactAndDeal(
  supabase: SupabaseClient,
  contactInput: NewContact,
  dealInput: Partial<Deal>,
  firstStageId: number
): Promise<DealWithContact> {
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert(contactInput)
    .select("*")
    .single();
  if (contactError) throw contactError;

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({ ...dealInput, contact_id: contact.id, stage_id: firstStageId })
    .select("*")
    .single();
  if (dealError) throw dealError;

  return { ...(deal as Deal), contact: contact as Contact };
}

export async function updateContactRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Contact>
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateDealRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Deal>
): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function addActivity(
  supabase: SupabaseClient,
  params: {
    dealId: string;
    contactId: string;
    contenu: string;
    createdBy: string | null;
  }
): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      deal_id: params.dealId,
      contact_id: params.contactId,
      type: "note",
      contenu: params.contenu,
      created_by: params.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Activity;
}

/**
 * Moves a deal to a new stage. The deals_log_stage trigger on loki-crm-prod
 * auto-inserts the changement_etape activity row server-side - no manual
 * insert needed here (unlike the scaffold's original clients-table version).
 */
export async function changeDealStage(
  supabase: SupabaseClient,
  dealId: string,
  newStageId: number
): Promise<Deal> {
  return updateDealRow(supabase, dealId, { stage_id: newStageId });
}

export interface ExportPayload {
  exportedAt: string;
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
}

/** Full backup export: every contact, deal, and activity, as downloadable JSON. */
export async function fetchExportPayload(supabase: SupabaseClient): Promise<ExportPayload> {
  const [
    { data: contacts, error: contactsError },
    { data: deals, error: dealsError },
    { data: activities, error: activitiesError },
  ] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at", { ascending: true }),
    supabase.from("deals").select("*").order("created_at", { ascending: true }),
    supabase.from("activities").select("*").order("created_at", { ascending: true }),
  ]);
  if (contactsError) throw contactsError;
  if (dealsError) throw dealsError;
  if (activitiesError) throw activitiesError;
  return {
    exportedAt: new Date().toISOString(),
    contacts: (contacts ?? []) as Contact[],
    deals: (deals ?? []) as Deal[],
    activities: (activities ?? []) as Activity[],
  };
}

// --- LOKI Intelligence ---------------------------------------------------

/**
 * One row per non-empty contacts.province_etat value, with a count -
 * grouped client-side (365 rows, trivial) rather than via a dedicated view,
 * since there's no existing one for this and the dataset is tiny.
 */
export async function fetchProvinceBreakdown(
  supabase: SupabaseClient
): Promise<{ province: string; count: number }[]> {
  const { data, error } = await supabase.from("contacts").select("province_etat");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { province_etat: string | null }[]) {
    const key = row.province_etat?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([province, count]) => ({ province, count }))
    .sort((a, b) => b.count - a.count);
}

/** public.v_sources - see supabase/migrations/0006_grant_reporting_views.sql. */
export async function fetchSourceBreakdown(supabase: SupabaseClient): Promise<SourceBreakdownRow[]> {
  const { data, error } = await supabase.from("v_sources").select("*");
  if (error) throw error;
  return (data ?? []) as SourceBreakdownRow[];
}

/** public.v_forecast_par_rep - see supabase/migrations/0006_grant_reporting_views.sql. */
export async function fetchForecastByRep(supabase: SupabaseClient): Promise<ForecastByRepRow[]> {
  const { data, error } = await supabase.from("v_forecast_par_rep").select("*");
  if (error) throw error;
  return (data ?? []) as ForecastByRepRow[];
}

// --- Trade-in vehicle photos ("Véhicule en échange") ---------------------
// See supabase/migrations/0015_create_deal_photos.sql for the private
// bucket + RLS this all depends on.

const TRADE_IN_PHOTOS_BUCKET = "trade-in-photos";

export async function fetchDealPhotos(supabase: SupabaseClient, dealId: string): Promise<DealPhoto[]> {
  const { data, error } = await supabase
    .from("deal_photos")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DealPhoto[];
}

/**
 * Uploads one file to the private bucket, then records it. The storage
 * path is opaque (random id, never the original filename) - the deal id
 * prefix is purely for organization, not an access boundary (is_internal()
 * via RLS is the actual boundary, same file is visible to every internal
 * rep regardless of path).
 */
export async function uploadDealPhoto(
  supabase: SupabaseClient,
  dealId: string,
  file: File,
  createdBy: string | null
): Promise<DealPhoto> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const storagePath = `${dealId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(TRADE_IN_PHOTOS_BUCKET).upload(storagePath, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("deal_photos")
    .insert({ deal_id: dealId, storage_path: storagePath, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as DealPhoto;
}

/** Removes the storage object first, then its row - so a failed row delete never leaves a dangling reference to bytes that no longer exist. */
export async function deleteDealPhoto(supabase: SupabaseClient, photo: DealPhoto): Promise<void> {
  const { error: storageError } = await supabase.storage.from(TRADE_IN_PHOTOS_BUCKET).remove([photo.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("deal_photos").delete().eq("id", photo.id);
  if (error) throw error;
}

/**
 * Batched signed-URL lookup for a private bucket - returns a
 * storage_path -> url map. Never persisted by the caller beyond component
 * state; regenerated fresh every time (deal drawer open, or right after an
 * upload) rather than cached, so an expired URL just means the next fetch
 * gets a new one. 1h default expiry - long enough for a normal viewing
 * session, short enough to bound exposure if a URL were ever copied/logged.
 */
export async function getSignedPhotoUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  expiresInSeconds = 3600
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(TRADE_IN_PHOTOS_BUCKET)
    .createSignedUrls(storagePaths, expiresInSeconds);
  if (error) throw error;
  const urls: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }
  return urls;
}

// --- Exchange rate (LOKI Intelligence CAD/USD toggle) ---------------------
// See supabase/migrations/0020_create_exchange_rates.sql - always exactly
// one row.

export async function fetchExchangeRate(supabase: SupabaseClient): Promise<ExchangeRateWithAuthor> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*, updated_by_profile:profiles(id, nom, email, role, created_at)")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as unknown as ExchangeRateWithAuthor;
}

export async function updateExchangeRate(
  supabase: SupabaseClient,
  id: string,
  usdToCad: number,
  updatedBy: string | null
): Promise<ExchangeRateWithAuthor> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .update({ usd_to_cad: usdToCad, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("id", id)
    .select("*, updated_by_profile:profiles(id, nom, email, role, created_at)")
    .single();
  if (error) throw error;
  return data as unknown as ExchangeRateWithAuthor;
}

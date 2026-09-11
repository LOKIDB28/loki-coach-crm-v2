import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  ActivityWithAuthor,
  Coach,
  Contact,
  Deal,
  DealWithContact,
  NewContact,
  PipelineStage,
  Profile,
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

/**
 * Deletes only the deal (and its activities/tasks, via ON DELETE CASCADE) -
 * the contact record is kept, since a contact can have other deals or just
 * standing history. Matches the real schema's contact/deal split; the
 * prototype's single-table "delete client" becomes "delete this deal".
 */
export async function deleteDealRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;
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

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  ActivityType,
  ActivityWithAuthor,
  Client,
  NewClient,
  Profile,
} from "./types";
import { stageById } from "./domain";

export async function fetchProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nom, email, created_at")
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchClients(supabase: SupabaseClient): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function fetchActivitiesForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<ActivityWithAuthor[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*, author:profiles(id, nom, email, created_at)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ActivityWithAuthor[];
}

export async function createClient(
  supabase: SupabaseClient,
  input: NewClient
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function updateClientRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Client>
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClientRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function addActivity(
  supabase: SupabaseClient,
  params: {
    clientId: string;
    type: ActivityType;
    contenu: string;
    createdBy: string | null;
  }
): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      client_id: params.clientId,
      type: params.type,
      contenu: params.contenu,
      created_by: params.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Activity;
}

/**
 * Moves a client to a new stage and logs a `changement_etape` activity row
 * recording the from/to stage and the author, per the required stage-history
 * behaviour. Two sequential requests (no DB function in this MVP) - fine for
 * a 3-4 user team, but not atomic; a failure between the two leaves the
 * stage updated without a history row, which is acceptable for this scale.
 */
export async function changeClientStage(
  supabase: SupabaseClient,
  client: Client,
  newStage: number,
  authorId: string | null
): Promise<Client> {
  const updated = await updateClientRow(supabase, client.id, { stage: newStage });
  const fromLabel = stageById(client.stage)?.label ?? `étape ${client.stage}`;
  const toLabel = stageById(newStage)?.label ?? `étape ${newStage}`;
  await addActivity(supabase, {
    clientId: client.id,
    type: "changement_etape",
    contenu: `${fromLabel} → ${toLabel}`,
    createdBy: authorId,
  });
  return updated;
}

export interface ExportPayload {
  exportedAt: string;
  clients: Client[];
  activities: Activity[];
}

/** Full backup export: every client plus every activity, as downloadable JSON. */
export async function fetchExportPayload(supabase: SupabaseClient): Promise<ExportPayload> {
  const [{ data: clients, error: clientsError }, { data: activities, error: activitiesError }] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: true }),
      supabase.from("activities").select("*").order("created_at", { ascending: true }),
    ]);
  if (clientsError) throw clientsError;
  if (activitiesError) throw activitiesError;
  return {
    exportedAt: new Date().toISOString(),
    clients: (clients ?? []) as Client[],
    activities: (activities ?? []) as Activity[],
  };
}

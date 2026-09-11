"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bus,
  CalendarClock,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Table2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addActivity,
  changeClientStage,
  createClient as createClientRow,
  deleteClientRow,
  fetchActivitiesForClient,
  fetchClients,
  fetchExportPayload,
  fetchProfiles,
  updateClientRow,
} from "@/lib/data";
import {
  findClientMatchesForClient,
  findCoachMatchesForClient,
  fullName,
  INTERETS,
  STAGE_NOTE_TYPE,
  STAGES,
} from "@/lib/domain";
import { ClientCard } from "@/components/ClientCard";
import { ClientDrawer } from "@/components/ClientDrawer";
import { FollowUpsView } from "@/components/FollowUpsView";
import { NewClientModal } from "@/components/NewClientModal";
import { PipelineBar } from "@/components/PipelineBar";
import { RecapTable } from "@/components/RecapTable";
import { RepresentativeTabs } from "@/components/RepresentativeTabs";
import type { ActivityWithAuthor, Client, NewClient, Profile } from "@/lib/types";

type ViewMode = "pipeline" | "suivis";

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupByInterest, setGroupByInterest] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityWithAuthor[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientRows, profileRows] = await Promise.all([
        fetchClients(supabase),
        fetchProfiles(supabase),
      ]);
      setClients(clientRows);
      setProfiles(profileRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadAll();
  }, [supabase, loadAll]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const loadActivities = useCallback(
    async (clientId: string) => {
      setActivitiesLoading(true);
      try {
        const rows = await fetchActivitiesForClient(supabase, clientId);
        setActivities(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setActivitiesLoading(false);
      }
    },
    [supabase]
  );

  function openClient(id: string) {
    setSelectedClientId(id);
    loadActivities(id);
  }

  async function handleCreateClient(input: NewClient, initialNote: string) {
    const created = await createClientRow(supabase, input);
    if (initialNote) {
      await addActivity(supabase, {
        clientId: created.id,
        type: "note_premier_contact",
        contenu: initialNote,
        createdBy: userId,
      });
    }
    setClients((prev) => [created, ...prev]);
  }

  async function handleUpdateSelected(patch: Partial<Client>) {
    if (!selectedClient) return;
    const updated = await updateClientRow(supabase, selectedClient.id, patch);
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleChangeStage(newStage: number) {
    if (!selectedClient) return;
    const updated = await changeClientStage(supabase, selectedClient, newStage, userId);
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    await loadActivities(updated.id);
  }

  async function handleAddNote(stageId: number, contenu: string) {
    if (!selectedClient) return;
    await addActivity(supabase, {
      clientId: selectedClient.id,
      type: STAGE_NOTE_TYPE[stageId] ?? "autre",
      contenu,
      createdBy: userId,
    });
    await loadActivities(selectedClient.id);
  }

  async function handleDeleteSelected() {
    if (!selectedClient) return;
    await deleteClientRow(supabase, selectedClient.id);
    setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
    setSelectedClientId(null);
  }

  async function handleExport() {
    try {
      const payload = await fetchExportPayload(supabase);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `loki-coach-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'exportation.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const c of clients) counts[c.stage] = (counts[c.stage] ?? 0) + 1;
    return counts;
  }, [clients]);

  const ownerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      if (c.owner_id) counts[c.owner_id] = (counts[c.owner_id] ?? 0) + 1;
    }
    return counts;
  }, [clients]);

  const dupeClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of clients) {
      if (findClientMatchesForClient(c, clients, c.id).length > 0) ids.add(c.id);
    }
    return ids;
  }, [clients]);

  const dupeCoachIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of clients) {
      if (findCoachMatchesForClient(c, clients, c.id).length > 0) ids.add(c.id);
    }
    return ids;
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (activeStage !== null && c.stage !== activeStage) return false;
      if (activeOwnerId !== null && c.owner_id !== activeOwnerId) return false;
      if (q) {
        const name = fullName({ prenom: c.prenom, nom: c.nom }).toLowerCase();
        const email = (c.email ?? "").toLowerCase();
        const phone = (c.telephone ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [clients, activeStage, activeOwnerId, search]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bus size={26} className="text-brass" strokeWidth={1.75} />
            <span className="font-heading text-xl uppercase tracking-widest text-text">
              LOKI <span className="text-brass">Coach</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide px-3 py-2 rounded-md border border-border text-textSoft hover:text-text hover:border-brass/50"
            >
              <RefreshCw size={14} /> Rafraîchir
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide px-3 py-2 rounded-md border border-border text-textSoft hover:text-text hover:border-brass/50"
            >
              <Download size={14} /> Exporter
            </button>
            <button
              type="button"
              onClick={() => setNewClientOpen(true)}
              className="flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide px-3 py-2 rounded-md bg-brass text-bg hover:bg-brassSoft"
            >
              <Plus size={14} /> Nouveau client
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide px-3 py-2 rounded-md border border-border text-textSoft hover:text-text hover:border-red-500/50"
              title="Se déconnecter"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="rounded-md border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <ViewTab
            active={viewMode === "pipeline"}
            onClick={() => setViewMode("pipeline")}
            icon={Table2}
            label="Pipeline"
          />
          <ViewTab
            active={viewMode === "suivis"}
            onClick={() => setViewMode("suivis")}
            icon={CalendarClock}
            label="Suivis à faire"
          />
        </div>

        {viewMode === "pipeline" && (
          <PipelineBar counts={stageCounts} activeStage={activeStage} onSelectStage={setActiveStage} />
        )}

        <RepresentativeTabs
          profiles={profiles}
          counts={ownerCounts}
          totalCount={clients.length}
          activeOwnerId={activeOwnerId}
          onSelect={setActiveOwnerId}
        />

        <button
          type="button"
          onClick={() => setShowRecap((v) => !v)}
          className="font-heading text-xs uppercase tracking-wide text-textSoft hover:text-brassSoft underline underline-offset-2"
        >
          {showRecap ? "Masquer le tableau récap" : "Afficher le tableau récap"}
        </button>
        {showRecap && <RecapTable clients={clients} profiles={profiles} />}

        {viewMode === "pipeline" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textFaint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, courriel, téléphone)"
                  className="w-full rounded-md bg-surface2 border border-border pl-9 pr-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-brass"
                />
              </div>

              {(activeStage !== null || activeOwnerId !== null || search) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeStage !== null && (
                    <Chip
                      label={`Étape: ${STAGES.find((s) => s.id === activeStage)?.label}`}
                      onClear={() => setActiveStage(null)}
                    />
                  )}
                  {activeOwnerId !== null && (
                    <Chip
                      label={`Rep.: ${
                        profileById.get(activeOwnerId)?.nom ?? profileById.get(activeOwnerId)?.email
                      }`}
                      onClear={() => setActiveOwnerId(null)}
                    />
                  )}
                  {search && <Chip label={`Recherche: ${search}`} onClear={() => setSearch("")} />}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-heading uppercase tracking-wide text-textSoft ml-auto">
                <input
                  type="checkbox"
                  checked={groupByInterest}
                  onChange={(e) => setGroupByInterest(e.target.checked)}
                  className="accent-[#C6A15B]"
                />
                Grouper par intérêt
              </label>
            </div>

            {loading ? (
              <p className="text-sm text-textFaint py-10 text-center">Chargement…</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-sm text-textFaint py-10 text-center">Aucun client ne correspond aux filtres actuels.</p>
            ) : groupByInterest ? (
              <div className="space-y-6">
                {INTERETS.map((interet) => {
                  const group = filteredClients.filter((c) => c.niveau_interet === interet.v);
                  if (group.length === 0) return null;
                  return (
                    <div key={interet.v}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: interet.c }}
                        />
                        <h3 className="font-heading text-sm uppercase tracking-wide text-brassSoft">
                          {interet.v} ({group.length})
                        </h3>
                      </div>
                      <ClientGrid
                        clients={group}
                        profileById={profileById}
                        dupeClientIds={dupeClientIds}
                        dupeCoachIds={dupeCoachIds}
                        onOpen={openClient}
                      />
                    </div>
                  );
                })}
                {(() => {
                  const noInterest = filteredClients.filter((c) => !c.niveau_interet);
                  if (noInterest.length === 0) return null;
                  return (
                    <div>
                      <h3 className="font-heading text-sm uppercase tracking-wide text-textSoft mb-2">
                        Sans niveau d&apos;intérêt ({noInterest.length})
                      </h3>
                      <ClientGrid
                        clients={noInterest}
                        profileById={profileById}
                        dupeClientIds={dupeClientIds}
                        dupeCoachIds={dupeCoachIds}
                        onOpen={openClient}
                      />
                    </div>
                  );
                })()}
              </div>
            ) : (
              <ClientGrid
                clients={filteredClients}
                profileById={profileById}
                dupeClientIds={dupeClientIds}
                dupeCoachIds={dupeCoachIds}
                onOpen={openClient}
              />
            )}
          </>
        )}

        {viewMode === "suivis" && (
          <FollowUpsView clients={clients} profiles={profiles} onOpen={(c) => openClient(c.id)} />
        )}
      </main>

      <NewClientModal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        profiles={profiles}
        existingClients={clients}
        onCreate={handleCreateClient}
      />

      {selectedClient && (
        <ClientDrawer
          client={selectedClient}
          profiles={profiles}
          allClients={clients}
          activities={activities}
          activitiesLoading={activitiesLoading}
          onClose={() => setSelectedClientId(null)}
          onUpdate={handleUpdateSelected}
          onChangeStage={handleChangeStage}
          onAddNote={handleAddNote}
          onDelete={handleDeleteSelected}
        />
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Table2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide px-3.5 py-2 rounded-md border transition-colors ${
        active
          ? "border-brass bg-brass/15 text-brassSoft"
          : "border-border bg-surface text-textSoft hover:border-brass/50"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface2 border border-border px-2.5 py-1 text-[11px] text-textSoft">
      {label}
      <button type="button" onClick={onClear} className="hover:text-text" aria-label="Retirer le filtre">
        <X size={11} />
      </button>
    </span>
  );
}

function ClientGrid({
  clients,
  profileById,
  dupeClientIds,
  dupeCoachIds,
  onOpen,
}: {
  clients: Client[];
  profileById: Map<string, Profile>;
  dupeClientIds: Set<string>;
  dupeCoachIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {clients.map((c) => (
        <ClientCard
          key={c.id}
          client={c}
          ownerName={c.owner_id ? profileById.get(c.owner_id)?.nom ?? profileById.get(c.owner_id)?.email ?? null : null}
          hasClientDupe={dupeClientIds.has(c.id)}
          hasCoachDupe={dupeCoachIds.has(c.id)}
          onOpen={() => onOpen(c.id)}
        />
      ))}
    </div>
  );
}

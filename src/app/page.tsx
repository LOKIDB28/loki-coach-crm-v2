"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, LogOut, Plus, RefreshCw, Search, Table2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addActivity,
  changeDealStage,
  createContactAndDeal,
  fetchActivitiesForDeal,
  fetchCoaches,
  fetchDeals,
  fetchExportPayload,
  fetchPipelineStages,
  fetchProfiles,
  updateContactRow,
  updateDealRow,
} from "@/lib/data";
import { findClientMatchesForDeal, findCoachMatchesForDeal, fullName, INTERETS } from "@/lib/domain";
import { getErrorMessage } from "@/lib/format";
import { DealCard } from "@/components/DealCard";
import { DealDrawer } from "@/components/DealDrawer";
import { FollowUpsView } from "@/components/FollowUpsView";
import { NewDealModal } from "@/components/NewDealModal";
import { PipelineBar } from "@/components/PipelineBar";
import { RecapTable } from "@/components/RecapTable";
import { RepresentativeTabs } from "@/components/RepresentativeTabs";
import type { ActivityWithAuthor, Coach, Contact, Deal, DealWithContact, NewContact, PipelineStage, Profile } from "@/lib/types";

type ViewMode = "pipeline" | "suivis";

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);

  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupByInterest, setGroupByInterest] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");

  const [newDealOpen, setNewDealOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityWithAuthor[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealRows, profileRows, stageRows, coachRows] = await Promise.all([
        fetchDeals(supabase),
        fetchProfiles(supabase),
        fetchPipelineStages(supabase),
        fetchCoaches(supabase),
      ]);
      setDeals(dealRows);
      setProfiles(profileRows);
      setStages(stageRows);
      setCoaches(coachRows);
    } catch (err) {
      setError(getErrorMessage(err, "Erreur de chargement."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadAll();
  }, [supabase, loadAll]);

  const selectedDeal = useMemo(() => deals.find((d) => d.id === selectedDealId) ?? null, [deals, selectedDealId]);

  const loadActivities = useCallback(
    async (dealId: string) => {
      setActivitiesLoading(true);
      try {
        const rows = await fetchActivitiesForDeal(supabase, dealId);
        setActivities(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setActivitiesLoading(false);
      }
    },
    [supabase]
  );

  function openDeal(id: string) {
    setSelectedDealId(id);
    loadActivities(id);
  }

  async function handleCreateDeal(contactInput: NewContact, dealInput: Partial<Deal>, initialNote: string) {
    const firstStage = stages.find((s) => s.code === "prospect") ?? stages[0];
    if (!firstStage) throw new Error("Aucune étape de pipeline configurée.");
    const created = await createContactAndDeal(supabase, contactInput, dealInput, firstStage.id);
    if (initialNote) {
      await addActivity(supabase, {
        dealId: created.id,
        contactId: created.contact_id,
        contenu: initialNote,
        createdBy: userId,
      });
    }
    setDeals((prev) => [created, ...prev]);
  }

  async function handleUpdateSelectedContact(patch: Partial<Contact>) {
    if (!selectedDeal) return;
    const updatedContact = await updateContactRow(supabase, selectedDeal.contact_id, patch);
    setDeals((prev) => prev.map((d) => (d.id === selectedDeal.id ? { ...d, contact: updatedContact } : d)));
  }

  async function handleUpdateSelectedDeal(patch: Partial<Deal>) {
    if (!selectedDeal) return;
    const updated = await updateDealRow(supabase, selectedDeal.id, patch);
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  }

  async function handleChangeStage(newStageId: number) {
    if (!selectedDeal) return;
    const updated = await changeDealStage(supabase, selectedDeal.id, newStageId);
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    await loadActivities(updated.id);
  }

  async function handleAddNote(contenu: string) {
    if (!selectedDeal) return;
    await addActivity(supabase, {
      dealId: selectedDeal.id,
      contactId: selectedDeal.contact_id,
      contenu,
      createdBy: userId,
    });
    await loadActivities(selectedDeal.id);
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
      setError(getErrorMessage(err, "Erreur lors de l'exportation."));
    }
  }

  /**
   * Rep-facing CSV export - the columns visible on screen, for whatever is
   * currently filtered (search/stage/owner). Synchronous, built from
   * filteredDeals already in memory - no extra fetch, unlike the full JSON
   * backup which re-pulls every row.
   */
  function handleExportCsv() {
    const headers = ["Client", "Téléphone", "Courriel", "Ville", "Étape", "Montant", "Canal", "Source", "Représentant"];
    const rows = filteredDeals.map((d) => {
      const owner = d.owner_id ? profileById.get(d.owner_id) : null;
      return [
        fullName(d.contact),
        d.contact.telephone ?? "",
        d.contact.email ?? "",
        d.contact.ville ?? "",
        stageById.get(d.stage_id)?.label ?? "",
        d.montant ?? "",
        d.canal,
        d.source ?? "",
        d.owner_id ? owner?.nom || owner?.email || "" : "Non assigné",
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `loki-coach-deals-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const d of deals) counts[d.stage_id] = (counts[d.stage_id] ?? 0) + 1;
    return counts;
  }, [deals]);

  const ownerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deals) {
      if (d.owner_id) counts[d.owner_id] = (counts[d.owner_id] ?? 0) + 1;
    }
    return counts;
  }, [deals]);

  const dupeClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of deals) {
      if (findClientMatchesForDeal(d, deals, d.id).length > 0) ids.add(d.id);
    }
    return ids;
  }, [deals]);

  const dupeCoachIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of deals) {
      if (findCoachMatchesForDeal(d, deals, d.id).length > 0) ids.add(d.id);
    }
    return ids;
  }, [deals]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (activeStage !== null && d.stage_id !== activeStage) return false;
      if (activeOwnerId !== null && d.owner_id !== activeOwnerId) return false;
      if (q) {
        const name = fullName(d.contact).toLowerCase();
        const email = (d.contact.email ?? "").toLowerCase();
        const phone = (d.contact.telephone ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [deals, activeStage, activeOwnerId, search]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/15 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="bg-onyx rounded-lg px-3 py-1.5 inline-flex items-center">
            <img src="/loki-coach-logo.svg" alt="LOKI Coach" className="h-6 sm:h-7 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40"
            >
              <RefreshCw size={14} /> Rafraîchir
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40"
            >
              <Download size={14} /> Exporter (Excel)
            </button>
            <button
              type="button"
              onClick={() => setNewDealOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-teal text-white hover:bg-teal/90"
            >
              <Plus size={14} /> Nouveau client
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="text-[11px] text-textSoft/60 hover:text-textSoft underline underline-offset-2"
            >
              Sauvegarde complète (JSON)
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-red-400/40"
              title="Se déconnecter"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <ViewTab active={viewMode === "pipeline"} onClick={() => setViewMode("pipeline")} icon={Table2} label="Pipeline" />
          <ViewTab
            active={viewMode === "suivis"}
            onClick={() => setViewMode("suivis")}
            icon={CalendarClock}
            label="Suivis à faire"
          />
        </div>

        {viewMode === "pipeline" && (
          <PipelineBar stages={stages} counts={stageCounts} activeStage={activeStage} onSelectStage={setActiveStage} />
        )}

        <RepresentativeTabs
          profiles={profiles}
          counts={ownerCounts}
          totalCount={deals.length}
          activeOwnerId={activeOwnerId}
          onSelect={setActiveOwnerId}
        />

        <button
          type="button"
          onClick={() => setShowRecap((v) => !v)}
          className="text-xs font-medium text-textSoft hover:text-teal underline underline-offset-2"
        >
          {showRecap ? "Masquer le tableau récap" : "Afficher le tableau récap"}
        </button>
        {showRecap && <RecapTable deals={deals} profiles={profiles} />}

        {viewMode === "pipeline" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSoft/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, courriel, téléphone)"
                  className="w-full rounded-lg bg-surface2 border border-border/20 pl-9 pr-3 py-2 text-sm text-text placeholder:text-textSoft/60 focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                />
              </div>

              {(activeStage !== null || activeOwnerId !== null || search) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeStage !== null && (
                    <Chip label={`Étape: ${stageById.get(activeStage)?.label}`} onClear={() => setActiveStage(null)} />
                  )}
                  {activeOwnerId !== null && (
                    <Chip
                      label={`Rep.: ${profileById.get(activeOwnerId)?.nom ?? profileById.get(activeOwnerId)?.email}`}
                      onClear={() => setActiveOwnerId(null)}
                    />
                  )}
                  {search && <Chip label={`Recherche: ${search}`} onClear={() => setSearch("")} />}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-textSoft ml-auto">
                <input
                  type="checkbox"
                  checked={groupByInterest}
                  onChange={(e) => setGroupByInterest(e.target.checked)}
                  className="accent-teal"
                />
                Grouper par intérêt
              </label>
            </div>

            {loading ? (
              <p className="text-sm text-textSoft py-10 text-center">Chargement…</p>
            ) : filteredDeals.length === 0 ? (
              <p className="text-sm text-textSoft py-10 text-center">Aucun client ne correspond aux filtres actuels.</p>
            ) : groupByInterest ? (
              <div className="space-y-6">
                {INTERETS.map((interet) => {
                  const group = filteredDeals.filter((d) => d.niveau_interet === interet.v);
                  if (group.length === 0) return null;
                  return (
                    <div key={interet.v}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: interet.c }} />
                        <h3 className="text-sm font-medium text-teal">
                          {interet.v} ({group.length})
                        </h3>
                      </div>
                      <DealGrid
                        deals={group}
                        stageById={stageById}
                        profileById={profileById}
                        dupeClientIds={dupeClientIds}
                        dupeCoachIds={dupeCoachIds}
                        onOpen={openDeal}
                      />
                    </div>
                  );
                })}
                {(() => {
                  const noInterest = filteredDeals.filter((d) => !d.niveau_interet);
                  if (noInterest.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-medium text-textSoft mb-2">
                        Sans niveau d&apos;intérêt ({noInterest.length})
                      </h3>
                      <DealGrid
                        deals={noInterest}
                        stageById={stageById}
                        profileById={profileById}
                        dupeClientIds={dupeClientIds}
                        dupeCoachIds={dupeCoachIds}
                        onOpen={openDeal}
                      />
                    </div>
                  );
                })()}
              </div>
            ) : (
              <DealGrid
                deals={filteredDeals}
                stageById={stageById}
                profileById={profileById}
                dupeClientIds={dupeClientIds}
                dupeCoachIds={dupeCoachIds}
                onOpen={openDeal}
              />
            )}
          </>
        )}

        {viewMode === "suivis" && <FollowUpsView deals={deals} profiles={profiles} onOpen={(d) => openDeal(d.id)} />}
      </main>

      <NewDealModal
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        profiles={profiles}
        existingDeals={deals}
        onCreate={handleCreateDeal}
      />

      {selectedDeal && (
        <DealDrawer
          deal={selectedDeal}
          stages={stages}
          profiles={profiles}
          coaches={coaches}
          allDeals={deals}
          activities={activities}
          activitiesLoading={activitiesLoading}
          onClose={() => setSelectedDealId(null)}
          onUpdateContact={handleUpdateSelectedContact}
          onUpdateDeal={handleUpdateSelectedDeal}
          onChangeStage={handleChangeStage}
          onAddNote={handleAddNote}
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
      className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border transition-colors ${
        active ? "border-teal bg-teal/10 text-teal" : "border-border/15 bg-surface text-textSoft hover:border-teal/40"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface2 border border-border/15 px-2.5 py-1 text-[11px] text-textSoft">
      {label}
      <button type="button" onClick={onClear} className="hover:text-text" aria-label="Retirer le filtre">
        <X size={11} />
      </button>
    </span>
  );
}

function DealGrid({
  deals,
  stageById,
  profileById,
  dupeClientIds,
  dupeCoachIds,
  onOpen,
}: {
  deals: DealWithContact[];
  stageById: Map<number, PipelineStage>;
  profileById: Map<string, Profile>;
  dupeClientIds: Set<string>;
  dupeCoachIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {deals.map((d) => (
        <DealCard
          key={d.id}
          deal={d}
          stage={stageById.get(d.stage_id)}
          ownerName={d.owner_id ? profileById.get(d.owner_id)?.nom ?? profileById.get(d.owner_id)?.email ?? null : null}
          hasClientDupe={dupeClientIds.has(d.id)}
          hasCoachDupe={dupeCoachIds.has(d.id)}
          onOpen={() => onOpen(d.id)}
        />
      ))}
    </div>
  );
}

/** RFC 4180-ish CSV cell: quotes the value only when it contains a comma, quote, or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

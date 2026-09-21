"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Download,
  Kanban,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Table2,
  X,
} from "lucide-react";
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
import { effectiveViewLayout, type ViewLayout } from "@/lib/view";
import { CalendarView } from "@/components/calendar/CalendarView";
import { DealCard } from "@/components/DealCard";
import { DealDrawer } from "@/components/DealDrawer";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { NewDealModal } from "@/components/NewDealModal";
import { PipelineBar } from "@/components/PipelineBar";
import { RecapTable } from "@/components/RecapTable";
import { RepresentativeTabs } from "@/components/RepresentativeTabs";
import type { ActivityWithAuthor, Coach, Contact, Deal, DealWithContact, NewContact, PipelineStage, Profile } from "@/lib/types";

type ViewMode = "pipeline" | "calendrier";

// Hidden 2026-09-15: niveau_interet is filled on ~1/370 deals, so the
// grouping had no visible effect. State/logic below are untouched - only
// the checkbox's visibility is gated, so re-enabling later is a one-line
// flip. See README "Dette technique / à faire" for the reactivation
// threshold.
const SHOW_GROUP_BY_INTEREST = false;

// useSearchParams() (used below for the .ics feed's ?deal=<id> deep link)
// requires a Suspense boundary above it during static generation, even
// though this whole page is client-rendered - Next still needs one for
// the build's prerender pass. DashboardPage stays the default export;
// DashboardPageInner is everything the component used to be.
export default function DashboardPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-sm text-textSoft">Chargement…</div>}
    >
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);

  const [activeStage, setActiveStage] = useState<number | null>(null);
  // Multi-select: empty array = "Tous" (no filter, matches the old `null`
  // meaning). Toggled via toggleOwnerId below, never a bare setter, so
  // clicking a rep always adds/removes just that one id.
  const [activeOwnerIds, setActiveOwnerIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [groupByInterest, setGroupByInterest] = useState(false);
  const [dupesOnly, setDupesOnly] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  // Independent from showArchived on purpose - see lib/view.ts.
  const [viewLayout, setViewLayout] = useState<ViewLayout>("grid");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Deep link from the .ics calendar feed's event description (?deal=<id>)
  // - only fires once deals have actually loaded (so it doesn't miss a
  // valid id just because the fetch hasn't resolved yet), and strips the
  // param afterward so it doesn't reopen on every re-render.
  useEffect(() => {
    const dealParam = searchParams.get("deal");
    if (!dealParam || deals.length === 0) return;
    if (deals.some((d) => d.id === dealParam)) {
      openDeal(dealParam);
    }
    router.replace("/", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, searchParams]);

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

  /**
   * Pass 1 of the kanban board: updates optimistically so the card doesn't
   * flicker back to its old column while the write is in flight, but
   * doesn't roll back on failure yet - that (plus incremental loading and
   * keyboard a11y) is the deliberately separate hardening pass agreed on
   * before starting this one. A failed write still surfaces the existing
   * error banner.
   */
  async function handleMoveDealStage(dealId: string, newStageId: number) {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)));
    try {
      await changeDealStage(supabase, dealId, newStageId);
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors du changement d'étape."));
    }
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

  function toggleOwnerId(ownerId: string) {
    setActiveOwnerIds((prev) => (prev.includes(ownerId) ? prev.filter((id) => id !== ownerId) : [...prev, ownerId]));
  }

  // Two mutually exclusive views, never mixed: by default every derived
  // list below (counts, recap, dupe checks, suivis, the grid itself) only
  // ever sees non-archived deals; toggling "Afficher les dossiers
  // archivés" switches that single shared source to archived-only - not a
  // union of both.
  const visibleDeals = useMemo(
    () => deals.filter((d) => (showArchived ? d.archived : !d.archived)),
    [deals, showArchived]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const d of visibleDeals) counts[d.stage_id] = (counts[d.stage_id] ?? 0) + 1;
    return counts;
  }, [visibleDeals]);

  const ownerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of visibleDeals) {
      if (d.owner_id) counts[d.owner_id] = (counts[d.owner_id] ?? 0) + 1;
    }
    return counts;
  }, [visibleDeals]);

  // NOTE (known limitation, kept as-is on purpose): duplicate detection runs
  // against ALL visibleDeals regardless of which reps are selected below -
  // it is NOT scoped to only cross-match between the currently selected
  // owners. So with Fred+PM selected, "Doublons seulement" shows any of
  // their deals that have a duplicate anywhere in the system (even one
  // owned by Marie-Pierre or Louis-Philippe), not strictly duplicates
  // between Fred and PM specifically. This matched the old single-select
  // behavior and was deliberately left unchanged when owner filtering went
  // multi-select - a true cross-selected-reps-only detection would be a
  // separate change, not an adjustment of this one.
  const dupeClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of visibleDeals) {
      if (findClientMatchesForDeal(d, visibleDeals, d.id).length > 0) ids.add(d.id);
    }
    return ids;
  }, [visibleDeals]);

  const dupeCoachIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of visibleDeals) {
      if (findCoachMatchesForDeal(d, visibleDeals, d.id).length > 0) ids.add(d.id);
    }
    return ids;
  }, [visibleDeals]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleDeals.filter((d) => {
      if (activeStage !== null && d.stage_id !== activeStage) return false;
      if (activeOwnerIds.length > 0 && (!d.owner_id || !activeOwnerIds.includes(d.owner_id))) return false;
      // Purely a display filter on top of the existing detection - reuses
      // dupeClientIds/dupeCoachIds as-is, never recomputes or touches the
      // matching logic itself.
      if (dupesOnly && !dupeClientIds.has(d.id) && !dupeCoachIds.has(d.id)) return false;
      if (q) {
        const name = fullName(d.contact).toLowerCase();
        const email = (d.contact.email ?? "").toLowerCase();
        const phone = (d.contact.telephone ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [visibleDeals, activeStage, activeOwnerIds, search, dupesOnly, dupeClientIds, dupeCoachIds]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Kanban is only ever actually shown per effectiveViewLayout (never while
  // viewing archives - see lib/view.ts); this also governs whether the
  // stage filter chip/PipelineBar renders, so it's never left masked but
  // still "active" once you're back on the grid.
  const layout = effectiveViewLayout(viewLayout, showArchived);

  // Same as filteredDeals but WITHOUT the stage filter - stage is the
  // columns themselves in kanban, so filtering to one stage first would
  // leave every other column empty. Owner + search still apply per column,
  // same as they apply to the grid.
  const openStages = useMemo(() => stages.filter((s) => s.is_open).sort((a, b) => a.position - b.position), [stages]);
  const kanbanDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleDeals.filter((d) => {
      if (activeOwnerIds.length > 0 && (!d.owner_id || !activeOwnerIds.includes(d.owner_id))) return false;
      if (q) {
        const name = fullName(d.contact).toLowerCase();
        const email = (d.contact.email ?? "").toLowerCase();
        const phone = (d.contact.telephone ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [visibleDeals, activeOwnerIds, search]);

  return (
    <div className="min-h-screen">
      {/* Very subtle brand gradient wash behind the whole page - purely so
          floating glass surfaces (DealDrawer, NewDealModal) have something
          with actual visual texture to blur; a flat bg-onyx/bg-paperDim
          backdrop made backdrop-blur read as almost no effect at all. */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, #090909 0%, #007D48 50%, #00A660 100%)",
          opacity: 0.06,
        }}
      />
      <header className="border-b border-border/15 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          {/* The full wordmark is 22.7:1 (1541x68) - even at a small height
              it needs 350-500px+ width, more than an iPhone's entire content
              width. Below sm, show the compact "LOKI" mark instead; the full
              wordmark only appears once there's room for it. The mark is
              dark text on transparent, so the plate flips light-on-dark to
              dark-on-light between the two - same shape/padding either way. */}
          <div className="bg-paper border border-border/15 sm:border-0 sm:bg-onyx rounded-lg px-3 py-1.5 inline-flex items-center shrink-0">
            <img src="/loki-mark.png" alt="LOKI" className="sm:hidden h-2.5 w-auto object-contain" />
            <img src="/loki-coach-logo.svg" alt="LOKI Coach" className="hidden sm:block h-6 sm:h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewDealOpen(true)}
              aria-label="Nouveau client"
              className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:px-3 sm:py-2 text-xs font-medium rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors duration-150"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nouveau client</span>
            </button>

            {/* Desktop-only secondary actions - folded into the "…" menu on mobile */}
            <button
              type="button"
              onClick={loadAll}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            >
              <RefreshCw size={14} /> Rafraîchir
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            >
              <Download size={14} /> Exporter (Excel)
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            >
              Sauvegarde complète (JSON)
            </button>
            <Link
              href="/settings"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            >
              <Settings size={14} /> Paramètres
            </Link>
            {/* Deliberately distinct from the other secondary actions - the
                one destination button we want to pop instead of blend in. */}
            <Link
              href="/intelligence"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#EDFF00] text-onyx hover:opacity-90 transition-opacity duration-150"
            >
              <BarChart3 size={14} /> LOKI Intelligence
            </Link>

            {/* Mobile-only compact menu: Rafraîchir, Exporter, Sauvegarde
                JSON, Paramètres, LOKI Intelligence, récap et archives
                toggles - everything that's a separate row or extra header
                button on desktop, collapsed to one trigger. */}
            <div className="relative sm:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Plus d'actions"
                aria-expanded={mobileMenuOpen}
                className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
              >
                <MoreHorizontal size={18} />
              </button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMobileMenuOpen(false)} />
                  {/* fixed + left/right (not absolute + w-64 anchored to this
                      small trigger) - guarantees the panel stays inside the
                      viewport regardless of where the trigger sits in the
                      header row, instead of a fixed width that can overflow
                      past the left edge. */}
                  <div className="fixed left-4 right-4 top-20 rounded-xl border border-border/15 bg-surface shadow-lg z-30 py-1.5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        loadAll();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-textSoft hover:bg-surface2 hover:text-text"
                    >
                      <RefreshCw size={16} /> Rafraîchir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExportCsv();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-textSoft hover:bg-surface2 hover:text-text"
                    >
                      <Download size={16} /> Exporter (Excel)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExport();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-textSoft hover:bg-surface2 hover:text-text"
                    >
                      Sauvegarde complète (JSON)
                    </button>
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-textSoft hover:bg-surface2 hover:text-text"
                    >
                      <Settings size={16} /> Paramètres
                    </Link>
                    {/* Deliberately distinct from the other rows - same pop as its desktop counterpart. */}
                    <Link
                      href="/intelligence"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-onyx bg-[#EDFF00] hover:opacity-90"
                    >
                      <BarChart3 size={16} /> LOKI Intelligence
                    </Link>
                    <div className="my-1 border-t border-border/15" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecap((v) => !v);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-orange hover:bg-surface2"
                    >
                      Récap
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowArchived((v) => !v);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-sm text-orange hover:bg-surface2"
                    >
                      Archivés
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:px-3 sm:py-2 gap-1.5 text-xs font-medium rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-red-400/40 transition-colors duration-150"
              title="Se déconnecter"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 sm:pb-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        {showArchived && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/15 bg-surface2 px-4 py-3 text-sm text-textSoft">
            <span>Vous consultez uniquement les dossiers archivés — les dossiers actifs sont masqués.</span>
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className="text-xs font-medium text-teal hover:underline shrink-0"
            >
              ← Retour aux dossiers actifs
            </button>
          </div>
        )}

        {/* Desktop-only - the bottom tab bar replaces this on mobile */}
        <div className="hidden sm:flex flex-wrap gap-2">
          <ViewTab active={viewMode === "pipeline"} onClick={() => setViewMode("pipeline")} icon={Table2} label="Pipeline" />
          <ViewTab
            active={viewMode === "calendrier"}
            onClick={() => setViewMode("calendrier")}
            icon={CalendarDays}
            label="Calendrier"
          />
        </div>

        {/* Hidden in kanban - the columns already are the stage filter, and
            gating this on `layout` (not just viewLayout) means it comes
            back the instant layout resolves to "grid" again, from either
            switching the toggle or leaving archived mode - activeStage
            itself is never touched either way, so it's immediately
            clickable again, never stuck half-disabled. */}
        {viewMode === "pipeline" && layout === "grid" && (
          <PipelineBar stages={stages} counts={stageCounts} activeStage={activeStage} onSelectStage={setActiveStage} />
        )}

        <RepresentativeTabs
          profiles={profiles}
          counts={ownerCounts}
          totalCount={visibleDeals.length}
          activeOwnerIds={activeOwnerIds}
          onToggle={toggleOwnerId}
          onSelectAll={() => setActiveOwnerIds([])}
        />

        {/* Desktop-only - these two toggles live in the "…" menu on mobile */}
        <div className="hidden sm:flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowRecap((v) => !v)}
            className="inline-flex items-center rounded-full border border-orange/40 bg-gradient-to-b from-orange/15 to-orange/5 px-2.5 py-1 text-xs text-orange hover:from-orange/25 hover:to-orange/10 transition-all duration-150"
          >
            Récap
          </button>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center rounded-full border border-orange/40 bg-gradient-to-b from-orange/15 to-orange/5 px-2.5 py-1 text-xs text-orange hover:from-orange/25 hover:to-orange/10 transition-all duration-150"
          >
            Archivés
          </button>
        </div>
        {showRecap && <RecapTable deals={visibleDeals} profiles={profiles} />}

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

              {/* activeStage's chip is grid-only (kanban already shows every
                  stage as a column - keeping the chip visible in kanban
                  would misleadingly imply it's still filtering something).
                  Owner/search chips stay visible in both, since kanban
                  columns are filtered by both same as the grid. */}
              {((layout === "grid" && activeStage !== null) || activeOwnerIds.length > 0 || search) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {layout === "grid" && activeStage !== null && (
                    <Chip label={`Étape: ${stageById.get(activeStage)?.label}`} onClear={() => setActiveStage(null)} />
                  )}
                  {activeOwnerIds.map((ownerId) => (
                    <Chip
                      key={ownerId}
                      label={`Rep.: ${profileById.get(ownerId)?.nom ?? profileById.get(ownerId)?.email}`}
                      onClear={() => toggleOwnerId(ownerId)}
                    />
                  ))}
                  {search && <Chip label={`Recherche: ${search}`} onClear={() => setSearch("")} />}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-textSoft min-h-11 py-2">
                <input
                  type="checkbox"
                  checked={dupesOnly}
                  onChange={(e) => setDupesOnly(e.target.checked)}
                  className="accent-teal w-4 h-4"
                />
                Doublons seulement
              </label>

              {SHOW_GROUP_BY_INTEREST && (
                <label className="flex items-center gap-2 text-xs font-medium text-textSoft min-h-11 py-2">
                  <input
                    type="checkbox"
                    checked={groupByInterest}
                    onChange={(e) => setGroupByInterest(e.target.checked)}
                    className="accent-teal w-4 h-4"
                  />
                  Grouper par intérêt
                </label>
              )}

              {/* Layout toggle - shown from the sm: breakpoint up (640px),
                  which includes tablets - officially in scope, not just an
                  accident of the breakpoint: touch drag/scroll was tested
                  and fixed for iPad (see KanbanBoard's TouchSensor).
                  True small-screen mobile stays unchanged (drawer, arrows,
                  buttons) below that breakpoint. Hidden entirely while
                  viewing archives (dragging an archived deal between open
                  stages doesn't mean anything - see lib/view.ts). */}
              {!showArchived && (
                <div className="hidden sm:flex items-center gap-1 ml-auto rounded-lg border border-border/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewLayout("grid")}
                    aria-label="Vue grille"
                    className={`flex items-center justify-center min-w-9 min-h-9 rounded-md transition-colors ${
                      layout === "grid" ? "bg-teal/10 text-teal" : "text-textSoft hover:text-text"
                    }`}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout("kanban")}
                    aria-label="Vue kanban"
                    className={`flex items-center justify-center min-w-9 min-h-9 rounded-md transition-colors ${
                      layout === "kanban" ? "bg-teal/10 text-teal" : "text-textSoft hover:text-text"
                    }`}
                  >
                    <Kanban size={15} />
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-textSoft py-10 text-center">Chargement…</p>
            ) : layout === "kanban" ? (
              <KanbanBoard
                deals={kanbanDeals}
                openStages={openStages}
                profileById={profileById}
                dupeClientIds={dupeClientIds}
                dupeCoachIds={dupeCoachIds}
                onOpen={openDeal}
                onMoveDeal={handleMoveDealStage}
              />
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

        {viewMode === "calendrier" && (
          <CalendarView deals={visibleDeals} profiles={profiles} onOpen={openDeal} />
        )}
      </main>

      {/* Mobile-only bottom tab bar - native iOS pattern, replaces the
          desktop ViewTab row + the "Afficher les archivés" toggle. */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border/15 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setViewMode("pipeline");
              setShowArchived(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-11 text-[11px] font-medium transition-colors duration-150 ${
              viewMode === "pipeline" && !showArchived ? "text-teal" : "text-textSoft"
            }`}
          >
            <Table2 size={20} />
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("calendrier");
              setShowArchived(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-11 text-[11px] font-medium transition-colors duration-150 ${
              viewMode === "calendrier" ? "text-teal" : "text-textSoft"
            }`}
          >
            <CalendarDays size={20} />
            Calendrier
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("pipeline");
              setShowArchived(true);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-11 text-[11px] font-medium transition-colors duration-150 ${
              showArchived ? "text-teal" : "text-textSoft"
            }`}
          >
            <Archive size={20} />
            Archives
          </button>
        </div>
      </nav>

      <NewDealModal
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        profiles={profiles}
        // Full deals list, not visibleDeals - a duplicate-of-an-archived-deal
        // is still worth flagging when creating a new one.
        existingDeals={deals}
        onCreate={handleCreateDeal}
      />

      {selectedDeal && (
        <DealDrawer
          deal={selectedDeal}
          stages={stages}
          profiles={profiles}
          coaches={coaches}
          allDeals={visibleDeals}
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
      <button type="button" onClick={onClear} className="hover:text-text p-3 -m-3" aria-label="Retirer le filtre">
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

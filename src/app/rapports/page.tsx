"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchDeals, fetchPipelineStages, fetchProfiles, fetchStageChangeActivities } from "@/lib/data";
import { getErrorMessage } from "@/lib/format";
import { computeReportRows, latestStageEntryByDeal, type PeriodRange, type ReportRow } from "@/lib/report";
import { ReportGenerator } from "@/components/rapports/ReportGenerator";
import type { DealWithContact, PipelineStage, Profile } from "@/lib/types";

/**
 * Standalone route, deliberately separate from /intelligence - the client
 * considers the two distinct spaces (team-facing report vs. management
 * analytics), not just an access-control distinction. No role restriction:
 * open to everyone (Jeff/PM/Fred included), same as every other route in
 * this app.
 */
export default function RapportsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  const openStages = useMemo(() => stages.filter((s) => s.is_open).sort((a, b) => a.position - b.position), [stages]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dealRows, profileRows, stageRows] = await Promise.all([
          fetchDeals(supabase),
          fetchProfiles(supabase),
          fetchPipelineStages(supabase),
        ]);
        setDeals(dealRows);
        setProfiles(profileRows);
        setStages(stageRows);
      } catch (err) {
        setError(getErrorMessage(err, "Erreur de chargement."));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  /**
   * Fetches changement_etape activities (only source of "how long in
   * current stage") on demand, then runs the actual computation - nothing
   * happens until "Générer un rapport" is clicked, per the on-demand
   * requirement (no standing widget).
   */
  async function handleGenerateReport(range: PeriodRange): Promise<ReportRow[]> {
    const stageChanges = await fetchStageChangeActivities(supabase);
    const stageEntryByDeal = latestStageEntryByDeal(deals, stageChanges);
    return computeReportRows({ deals, profiles, openStages, stageEntryByDeal, period: range });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/15 bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-text">Rapports</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-textSoft py-10 text-center">Chargement…</p>
        ) : (
          <ReportGenerator openStages={openStages} onGenerate={handleGenerateReport} />
        )}
      </main>
    </div>
  );
}

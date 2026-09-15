"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchDeals,
  fetchForecastByRep,
  fetchPipelineStages,
  fetchProvinceBreakdown,
  fetchSourceBreakdown,
} from "@/lib/data";
import { getErrorMessage } from "@/lib/format";
import { ForecastCard } from "@/components/intelligence/ForecastCard";
import { PipelineFunnelChart } from "@/components/intelligence/PipelineFunnelChart";
import { ProvinceBarChart } from "@/components/intelligence/ProvinceBarChart";
import { ProvinceMap } from "@/components/intelligence/ProvinceMap";
import { RateFunnelChart } from "@/components/intelligence/RateFunnelChart";
import { RateShareChart } from "@/components/intelligence/RateShareChart";
import { SourceBreakdownChart } from "@/components/intelligence/SourceBreakdownChart";
import type { DealWithContact, ForecastByRepRow, PipelineStage, SourceBreakdownRow } from "@/lib/types";

export default function IntelligencePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [provinces, setProvinces] = useState<{ province: string; count: number }[]>([]);
  const [sources, setSources] = useState<SourceBreakdownRow[]>([]);
  const [forecast, setForecast] = useState<ForecastByRepRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dealRows, stageRows, provinceRows, sourceRows, forecastRows] = await Promise.all([
          fetchDeals(supabase),
          fetchPipelineStages(supabase),
          fetchProvinceBreakdown(supabase),
          fetchSourceBreakdown(supabase),
          fetchForecastByRep(supabase),
        ]);
        setDeals(dealRows);
        setStages(stageRows);
        setProvinces(provinceRows);
        setSources(sourceRows);
        setForecast(forecastRows);
      } catch (err) {
        setError(getErrorMessage(err, "Erreur de chargement."));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const d of deals) counts[d.stage_id] = (counts[d.stage_id] ?? 0) + 1;
    return counts;
  }, [deals]);

  const dealsWithMontant = useMemo(() => deals.filter((d) => d.montant !== null).length, [deals]);

  const dealsWithRate = useMemo(() => deals.filter((d) => d.rate_percent !== null), [deals]);
  const qualifiedDeals = useMemo(() => dealsWithRate.filter((d) => d.rate_percent! >= 10), [dealsWithRate]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/15 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-semibold text-text">LOKI Intelligence</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-textSoft py-10 text-center">Chargement…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Funnel du pipeline</h2>
              <p className="text-xs text-textSoft mb-4">Nombre de deals par étape.</p>
              <PipelineFunnelChart stages={stages} counts={stageCounts} />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Contacts par province / état</h2>
              <p className="text-xs text-textSoft mb-4">
                Basé sur le champ province/état des contacts (ville n&apos;est pas géocodable - texte libre par région).
              </p>
              <ProvinceBarChart data={provinces} />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-text mb-1">Carte des contacts par province/état</h2>
              <p className="text-xs text-textSoft mb-4">
                Un point par région (jamais par ville - texte libre non géocodable), taille proportionnelle au nombre
                de contacts.
              </p>
              <ProvinceMap data={provinces} />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Répartition par source</h2>
              <p className="text-xs text-textSoft mb-4">Nombre de deals par source d&apos;acquisition.</p>
              <SourceBreakdownChart data={sources} />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-1">Forecast pondéré</h2>
              <p className="text-xs text-textSoft mb-4">Montant × probabilité de l&apos;étape, étapes ouvertes seulement.</p>
              <ForecastCard rows={forecast} totalDeals={deals.length} dealsWithMontant={dealsWithMontant} />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <RateShareChart
                title="Répartition par taux (tous)"
                description="Tous les deals ayant un taux enregistré, groupés par valeur."
                deals={dealsWithRate}
                totalDeals={deals.length}
              />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5">
              <RateShareChart
                title="Opportunités qualifiées (≥10%)"
                description="Même donnée, en excluant les leads froids/bruts (0, 1, 5, 8%)."
                deals={qualifiedDeals}
                totalDeals={deals.length}
                scaleToSubset
              />
            </section>

            <section className="bg-surface border border-border/15 rounded-xl p-5 lg:col-span-2">
              <RateFunnelChart deals={dealsWithRate} totalDeals={deals.length} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

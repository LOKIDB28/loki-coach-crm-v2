"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchDeals,
  fetchExchangeRate,
  fetchForecastByRep,
  fetchPipelineStages,
  fetchProfiles,
  fetchProvinceBreakdown,
  fetchSourceBreakdown,
  updateExchangeRate,
} from "@/lib/data";
import { getErrorMessage } from "@/lib/format";
import { ExchangeRateBar } from "@/components/intelligence/ExchangeRateBar";
import { ForecastCard } from "@/components/intelligence/ForecastCard";
import { PipelineFunnelChart } from "@/components/intelligence/PipelineFunnelChart";
import { ProvinceBarChart } from "@/components/intelligence/ProvinceBarChart";
import { ProvinceMap } from "@/components/intelligence/ProvinceMap";
import { RateFunnelChart } from "@/components/intelligence/RateFunnelChart";
import { RateShareChart } from "@/components/intelligence/RateShareChart";
import { RepStageForecastChart } from "@/components/intelligence/RepStageForecastChart";
import { SourceBreakdownChart } from "@/components/intelligence/SourceBreakdownChart";
import { WidgetInfoTooltip } from "@/components/intelligence/WidgetInfoTooltip";
import type {
  DealWithContact,
  ExchangeRateWithAuthor,
  ForecastByRepRow,
  PipelineStage,
  Profile,
  SourceBreakdownRow,
} from "@/lib/types";

export default function IntelligencePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [deals, setDeals] = useState<DealWithContact[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [provinces, setProvinces] = useState<{ province: string; count: number }[]>([]);
  const [sources, setSources] = useState<SourceBreakdownRow[]>([]);
  const [forecast, setForecast] = useState<ForecastByRepRow[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateWithAuthor | null>(null);
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dealRows, stageRows, profileRows, provinceRows, sourceRows, forecastRows, rate] = await Promise.all([
          fetchDeals(supabase),
          fetchPipelineStages(supabase),
          fetchProfiles(supabase),
          fetchProvinceBreakdown(supabase),
          fetchSourceBreakdown(supabase),
          fetchForecastByRep(supabase),
          fetchExchangeRate(supabase),
        ]);
        setDeals(dealRows);
        setStages(stageRows);
        setProfiles(profileRows);
        setProvinces(provinceRows);
        setSources(sourceRows);
        setForecast(forecastRows);
        setExchangeRate(rate);
      } catch (err) {
        setError(getErrorMessage(err, "Erreur de chargement."));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  async function handleUpdateExchangeRate(usdToCad: number) {
    if (!exchangeRate) return;
    const updated = await updateExchangeRate(supabase, exchangeRate.id, usdToCad, userId);
    setExchangeRate(updated);
  }

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150"
              aria-label="Retour au dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-text">LOKI Intelligence</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {exchangeRate && <ExchangeRateBar rate={exchangeRate} onUpdate={handleUpdateExchangeRate} />}
            {/* Disabled until the shared rate has loaded - never convert with a missing rate. */}
            <div className="flex items-center gap-1 rounded-lg border border-border/20 p-0.5">
              {(["CAD", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  disabled={c === "USD" && !exchangeRate}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                    currency === c ? "bg-teal/10 text-teal" : "text-textSoft hover:text-text"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
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
            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Nombre de deals actuellement à chaque étape du pipeline, tous représentants confondus. Un deal compte
                une seule fois, à son étape actuelle seulement — ce n&apos;est pas un cumul historique de tous les
                deals qui sont déjà passés par cette étape.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Funnel du pipeline</h2>
              <p className="text-xs text-textSoft mb-4">Nombre de deals par étape.</p>
              <PipelineFunnelChart stages={stages} counts={stageCounts} />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Compte des contacts, pas des deals — un contact avec 3 deals ouverts n&apos;apparaît qu&apos;une fois
                ici. Basé sur le champ libre province/état saisi à la fiche contact, jamais sur la ville (non
                géocodable) : deux orthographes différentes du même endroit (« Qc » et « Québec ») compteront comme
                deux groupes distincts.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Contacts par province / état</h2>
              <p className="text-xs text-textSoft mb-4">
                Basé sur le champ province/état des contacts (ville n&apos;est pas géocodable - texte libre par région).
              </p>
              <ProvinceBarChart data={provinces} />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5 lg:col-span-2">
              <WidgetInfoTooltip>
                Même donnée que le graphique en barres à gauche, en carte plutôt qu&apos;en liste — un point par
                province/état, jamais par ville. La taille du point est relative aux autres régions affichées, pas à
                une échelle absolue : un point deux fois plus gros représente environ deux fois plus de contacts, pas
                un seuil fixe.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Carte des contacts par province/état</h2>
              <p className="text-xs text-textSoft mb-4">
                Un point par région (jamais par ville - texte libre non géocodable), taille proportionnelle au nombre
                de contacts.
              </p>
              <ProvinceMap data={provinces} />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Nombre de deals par source d&apos;acquisition déclarée, triés du plus fréquent au moins fréquent. Une
                couleur par source, attribuée automatiquement — la couleur d&apos;une source donnée peut changer
                d&apos;une visite à l&apos;autre si la liste des sources présentes change, ce n&apos;est pas un code
                couleur fixe à mémoriser.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Répartition par source</h2>
              <p className="text-xs text-textSoft mb-4">Nombre de deals par source d&apos;acquisition.</p>
              <SourceBreakdownChart data={sources} />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Valeur pondérée = montant du deal × probabilité de son étape actuelle, additionné sur toutes les
                étapes ouvertes. Un deal à 20 000 $ à une étape à 50 % de probabilité contribue 10 000 $ au total. La
                valeur brute ignore la probabilité — c&apos;est la somme des montants tels quels. Les deux restent
                des estimations sur des deals en cours, pas des revenus réels.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Forecast pondéré</h2>
              <p className="text-xs text-textSoft mb-4">Montant × probabilité de l&apos;étape, étapes ouvertes seulement.</p>
              <ForecastCard
                rows={forecast}
                totalDeals={deals.length}
                dealsWithMontant={dealsWithMontant}
                currency={currency}
                usdToCad={exchangeRate?.usd_to_cad}
              />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5 lg:col-span-2">
              <WidgetInfoTooltip>
                Même calcul que le Forecast pondéré ci-dessus (montant × probabilité de l&apos;étape), détaillé par
                représentant et par étape plutôt qu&apos;en un seul total. Utile pour repérer où se trouve chaque
                deal dans le pipeline d&apos;un vendeur précis — pas pour comparer leur performance globale : un
                vendeur avec plus de deals à un stade avancé aura naturellement des barres plus hautes.
              </WidgetInfoTooltip>
              <h2 className="text-sm font-semibold text-text mb-1">Forecast par vendeur et par étape</h2>
              <p className="text-xs text-textSoft mb-4">
                Version détaillée du forecast pondéré ci-dessus, par représentant et par étape ouverte.
              </p>
              <RepStageForecastChart
                deals={deals}
                stages={stages}
                profiles={profiles}
                currency={currency}
                usdToCad={exchangeRate?.usd_to_cad}
              />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Le « taux » ici (rate_percent) est un chiffre indépendant de l&apos;étape du pipeline et de sa
                probabilité — ce n&apos;est pas la même donnée que le Forecast pondéré plus haut, même si les deux
                parlent de « probabilité ». Regroupe tous les deals ayant un taux enregistré, peu importe leur étape
                actuelle ; une tranche sans aucun deal n&apos;apparaît simplement pas dans le graphique.
              </WidgetInfoTooltip>
              <RateShareChart
                title="Répartition par taux (tous)"
                description="Tous les deals ayant un taux enregistré, groupés par valeur."
                deals={dealsWithRate}
                totalDeals={deals.length}
              />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5">
              <WidgetInfoTooltip>
                Même donnée que « Répartition par taux (tous) », en retirant les leads froids/bruts (0, 1, 5, 8 %)
                pour ne garder que les deals jugés qualifiés. Les couleurs sont réajustées pour utiliser toute la
                gamme d&apos;intensité sur ce sous-ensemble — la teinte d&apos;une même valeur de taux peut donc
                différer entre ce graphique et celui du dessus, ce n&apos;est pas une incohérence.
              </WidgetInfoTooltip>
              <RateShareChart
                title="Opportunités qualifiées (≥10%)"
                description="Même donnée, en excluant les leads froids/bruts (0, 1, 5, 8%)."
                deals={qualifiedDeals}
                totalDeals={deals.length}
                scaleToSubset
              />
            </section>

            <section className="relative bg-surface border border-border/15 rounded-xl p-5 lg:col-span-2">
              <WidgetInfoTooltip>
                Même donnée que les deux graphiques « taux » ci-dessus, présentée en barres ordonnées du taux le plus
                élevé au plus faible plutôt qu&apos;en proportions. Utile pour voir la distribution/la queue de la
                répartition d&apos;un coup d&apos;œil, pas seulement la part de chaque tranche.
              </WidgetInfoTooltip>
              <RateFunnelChart deals={dealsWithRate} totalDeals={deals.length} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

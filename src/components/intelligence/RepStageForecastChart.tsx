"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REP_FILTERS } from "@/lib/calendar";
import { assignCategoricalColors } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { CHART_TOOLTIP_STYLE } from "@/lib/theme";
import type { DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface RepStageForecastChartProps {
  deals: DealWithContact[];
  stages: PipelineStage[];
  profiles: Profile[];
  currency: "CAD" | "USD";
  usdToCad?: number;
}

type Metric = "nb_deals" | "valeur_brute" | "valeur_ponderee";

const METRICS: { key: Metric; label: string }[] = [
  { key: "nb_deals", label: "Deals actifs" },
  { key: "valeur_brute", label: "Valeur brute" },
  { key: "valeur_ponderee", label: "Valeur pondérée" },
];

/**
 * Graphique par vendeur (Jeff/PM/Fred - REP_FILTERS, lib/calendar.ts, the
 * same fixed 3-person scope already used for the calendar's rep filter,
 * not the fuller 5-person REP_TAB_ORDER) x étape ouverte - a "plus poussé"
 * companion to ForecastCard, which only aggregates per rep with no stage
 * dimension. Computed entirely client-side from deals/stages the page
 * already has loaded, no new fetch/view. Same formula as ForecastCard's
 * own documented one: valeur pondérée = montant x pipeline_stages
 * .probability, open stages only.
 */
export function RepStageForecastChart({ deals, stages, profiles, currency, usdToCad }: RepStageForecastChartProps) {
  const [metric, setMetric] = useState<Metric>("valeur_ponderee");

  const openStages = useMemo(
    () => [...stages].filter((s) => s.is_open).sort((a, b) => a.position - b.position),
    [stages]
  );

  const reps = useMemo(
    () =>
      REP_FILTERS.map((f) => ({ label: f.label, profileId: profiles.find((p) => p.email === f.email)?.id ?? null })).filter(
        (r): r is { label: (typeof REP_FILTERS)[number]["label"]; profileId: string } => r.profileId !== null
      ),
    [profiles]
  );

  const repColors = useMemo(() => assignCategoricalColors(reps.map((r) => r.label)), [reps]);

  const data = useMemo(
    () =>
      openStages.map((stage) => {
        const row: Record<string, number | string> = { label: stage.label };
        for (const rep of reps) {
          const repDeals = deals.filter((d) => d.owner_id === rep.profileId && d.stage_id === stage.id);
          if (metric === "nb_deals") {
            row[rep.label] = repDeals.length;
          } else if (metric === "valeur_brute") {
            row[rep.label] = repDeals.reduce((sum, d) => sum + Number(d.montant ?? 0), 0);
          } else {
            row[rep.label] = repDeals.reduce((sum, d) => sum + Number(d.montant ?? 0) * (stage.probability / 100), 0);
          }
        }
        return row;
      }),
    [openStages, reps, deals, metric]
  );

  const isCurrency = metric !== "nb_deals";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-orange/30 bg-orange/5 px-3 py-2 text-xs text-orange">
        Deals ouverts uniquement — ce ne sont pas des ventes conclues. Aucune vente gagnée n&apos;est encore
        enregistrée dans le système.
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border/20 p-0.5 w-fit">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
              metric === m.key ? "bg-teal/10 text-teal" : "text-textSoft hover:text-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {reps.length === 0 ? (
        <p className="text-sm text-textSoft py-6 text-center">
          Aucun des représentants Jeff/PM/Fred n&apos;a encore de profil correspondant.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, openStages.length * 60)}>
          <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="rgb(var(--border) / 0.15)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgb(var(--text))", fontSize: 12 }}
              axisLine={{ stroke: "rgb(var(--border) / 0.3)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "rgb(var(--text-soft))", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (isCurrency ? formatCurrency(v, currency, usdToCad) : String(v))}
            />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: unknown) => (isCurrency ? formatCurrency(value as number, currency, usdToCad) : (value as number))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {reps.map((rep) => (
              <Bar key={rep.label} dataKey={rep.label} fill={repColors.get(rep.label)} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { FileText, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getPeriodRange, STAGNATION_THRESHOLD_DAYS, type PeriodRange, type ReportPeriod, type ReportRow } from "@/lib/report";
import type { PipelineStage } from "@/lib/types";
import { PeriodSelector } from "./PeriodSelector";

interface ReportGeneratorProps {
  openStages: PipelineStage[];
  onGenerate: (range: PeriodRange) => Promise<ReportRow[]>;
}

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  semaine: "Cette semaine",
  mois: "Ce mois",
  custom: "Période personnalisée",
};

/**
 * Rapport calculé à la demande (aucun fetch/calcul tant que le bouton n'est
 * pas cliqué) - pas un widget qui tourne en permanence, par direction
 * explicite du client. `onGenerate` (passé par la page) fait le fetch +
 * calcul réel (lib/report.ts) ; ce composant ne fait que la sélection de
 * période et l'affichage.
 *
 * Export PDF : window.print() + le scoping CSS .report-print
 * (globals.css), pas de nouvelle dépendance - le sélecteur de période et le
 * bouton "Exporter" lui-même vivent délibérément HORS de .report-print
 * (frères, pas enfants) pour être masqués automatiquement à l'impression
 * sans avoir besoin d'une classe "no-print" séparée à maintenir.
 */
export function ReportGenerator({ openStages, onGenerate }: ReportGeneratorProps) {
  const [started, setStarted] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [range, setRange] = useState<PeriodRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReport(nextPeriod: ReportPeriod, start?: string, end?: string) {
    setLoading(true);
    setError(null);
    try {
      const nextRange = getPeriodRange(nextPeriod, start, end);
      const result = await onGenerate(nextRange);
      setRows(result);
      setRange(nextRange);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du calcul du rapport.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPeriod(next: ReportPeriod) {
    setPeriod(next);
    // "custom" only reveals the date inputs (PeriodSelector) - generation
    // waits for onCustomSubmit once both dates are filled.
    if (next !== "custom") runReport(next);
  }

  return (
    <div className="space-y-5">
      {!started ? (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors duration-150"
        >
          <FileText size={16} /> Générer un rapport
        </button>
      ) : (
        <div className="rounded-xl border border-border/15 bg-surface p-4 space-y-3">
          <PeriodSelector
            period={period}
            customStart={customStart}
            customEnd={customEnd}
            loading={loading}
            onSelect={handleSelectPeriod}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            onCustomSubmit={() => runReport("custom", customStart, customEnd)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {loading && <p className="text-sm text-textSoft">Calcul en cours…</p>}
        </div>
      )}

      {rows && range && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="report-print flex-1 rounded-xl border border-border/15 bg-surface p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-text">
                Rapport d&apos;équipe — {period ? PERIOD_LABELS[period] : ""}
              </h2>
              <p className="text-xs text-textSoft">
                Du {formatDate(range.start.toISOString())} au {formatDate(range.end.toISOString())} — généré le{" "}
                {formatDate(new Date().toISOString())}
              </p>
            </div>

            <div className="rounded-lg border border-orange/30 bg-orange/5 px-3 py-2 text-xs text-orange">
              Rapport strictement factuel — aucune interprétation générée par le système. Seuil de stagnation actuel :{" "}
              {STAGNATION_THRESHOLD_DAYS} jours sans changement d&apos;étape — une estimation de départ, ajustable,
              pas encore calculée sur un vrai historique de ventes fermées.
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-textSoft border-b border-border/15">
                    <th className="py-2 pr-3 font-medium">Représentant</th>
                    <th className="py-2 pr-3 font-medium">Délai moyen 1er contact</th>
                    <th className="py-2 pr-3 font-medium">Deals stagnants (≥{STAGNATION_THRESHOLD_DAYS}j)</th>
                    <th className="py-2 pr-3 font-medium">Relances en retard (période)</th>
                    <th className="py-2 font-medium">Répartition par étape (actif)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b border-border/10 last:border-0 align-top">
                      <td className="py-2.5 pr-3 font-medium text-text">{row.label}</td>
                      <td className="py-2.5 pr-3 text-text">
                        {row.avgFirstContactDays !== null
                          ? `${row.avgFirstContactDays.toFixed(1)} j (${row.firstContactSampleSize} deal${
                              row.firstContactSampleSize > 1 ? "s" : ""
                            })`
                          : "— (aucun deal créé dans la période)"}
                      </td>
                      <td className="py-2.5 pr-3 text-text">{row.stagnantCount}</td>
                      <td className="py-2.5 pr-3 text-text">{row.overdueFollowUpsInPeriod}</td>
                      <td className="py-2.5 text-textSoft text-xs">
                        {openStages
                          .filter((s) => (row.stageCounts[s.id] ?? 0) > 0)
                          .map((s) => `${s.label}: ${row.stageCounts[s.id]}`)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border/20 text-textSoft hover:text-text hover:border-teal/40 transition-colors duration-150 shrink-0"
          >
            <Printer size={14} /> Exporter en PDF
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { formatCurrency } from "@/lib/format";
import type { ForecastByRepRow } from "@/lib/types";

interface ForecastCardProps {
  rows: ForecastByRepRow[];
  totalDeals: number;
  dealsWithMontant: number;
}

/**
 * Not a chart - with owner_id unset on every deal right now, "by rep" is
 * currently a single "Non assigné" bucket, and montant is only recorded on
 * a small fraction of deals. A bar chart with one bar would look broken;
 * a stat card with an explicit sample-size caveat is the honest way to
 * show a real (if incomplete) number instead of a misleadingly confident one.
 */
export function ForecastCard({ rows, totalDeals, dealsWithMontant }: ForecastCardProps) {
  const totals = rows.reduce(
    (acc, r) => ({
      valeur_brute: acc.valeur_brute + Number(r.valeur_brute),
      valeur_ponderee: acc.valeur_ponderee + Number(r.valeur_ponderee),
      nb_deals: acc.nb_deals + Number(r.nb_deals),
    }),
    { valeur_brute: 0, valeur_ponderee: 0, nb_deals: 0 }
  );
  const pct = totalDeals > 0 ? Math.round((dealsWithMontant / totalDeals) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-orange/30 bg-orange/5 px-3 py-2 text-xs text-orange">
        Basé sur {dealsWithMontant} deal{dealsWithMontant > 1 ? "s" : ""} sur {totalDeals} ayant un montant
        enregistré ({pct}%).{" "}
        {rows.length <= 1 &&
          "Aucun deal n'est encore assigné à un représentant — pas de répartition par personne possible pour l'instant."}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/15 bg-surface p-4">
          <div className="text-xs text-textSoft mb-1">Valeur brute</div>
          <div className="text-xl font-bold text-text">{formatCurrency(totals.valeur_brute)}</div>
        </div>
        <div className="rounded-xl border border-border/15 bg-surface p-4">
          <div className="text-xs text-textSoft mb-1">Valeur pondérée</div>
          <div className="text-xl font-bold text-teal">{formatCurrency(totals.valeur_ponderee)}</div>
        </div>
        <div className="rounded-xl border border-border/15 bg-surface p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-textSoft mb-1">Deals ouverts</div>
          <div className="text-xl font-bold text-text">{totals.nb_deals}</div>
        </div>
      </div>

      {rows.length > 1 && (
        <div className="overflow-x-auto rounded-xl border border-border/15">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface2">
                <th className="text-left text-[11px] font-medium text-textSoft px-3 py-2">Représentant</th>
                <th className="text-right text-[11px] font-medium text-textSoft px-3 py-2">Deals</th>
                <th className="text-right text-[11px] font-medium text-textSoft px-3 py-2">Brut</th>
                <th className="text-right text-[11px] font-medium text-teal px-3 py-2">Pondéré</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.proprietaire} className="border-t border-border/15">
                  <td className="px-3 py-2 text-text">{r.proprietaire}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-textSoft">{Number(r.nb_deals)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-textSoft">
                    {formatCurrency(Number(r.valeur_brute))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-teal">
                    {formatCurrency(Number(r.valeur_ponderee))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rateColor } from "@/lib/domain";
import type { Deal } from "@/lib/types";

interface RateFunnelChartProps {
  deals: Pick<Deal, "rate_percent">[];
  totalDeals: number;
}

/**
 * A second, finer-grained maturity reading than the 5-stage pipeline
 * funnel - same horizontal-bar shape, grouped by rate_percent instead of
 * stage_id, highest value at top per request (descending order).
 */
export function RateFunnelChart({ deals, totalDeals }: RateFunnelChartProps) {
  const counts = new Map<number, number>();
  for (const d of deals) {
    if (d.rate_percent === null) continue;
    counts.set(d.rate_percent, (counts.get(d.rate_percent) ?? 0) + 1);
  }
  const data = [...counts.entries()]
    .map(([value, count]) => ({ value, label: `${value}%`, count }))
    .sort((a, b) => b.value - a.value);
  const shown = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">Funnel par taux</h2>
      <p className="text-xs text-textSoft mb-4">
        Deuxième lecture de la maturité des deals, plus fine que les 5 étapes du pipeline.
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-textSoft py-10 text-center">Aucun deal n&apos;a de taux enregistré.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid horizontal={false} stroke="rgb(var(--border) / 0.15)" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "rgb(var(--text-soft))", fontSize: 12 }}
              axisLine={{ stroke: "rgb(var(--border) / 0.3)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={50}
              tick={{ fill: "rgb(var(--text))", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgb(var(--surface))",
                border: "1px solid rgb(var(--border) / 0.2)",
                borderRadius: 8,
                fontSize: 12,
                color: "rgb(var(--text))",
              }}
              cursor={{ fill: "rgb(var(--border) / 0.08)" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((d) => (
                <Cell key={d.value} fill={rateColor(d.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-textSoft mt-2">
        Basé sur {shown} deal{shown > 1 ? "s" : ""} sur {totalDeals} ayant un taux enregistré.
      </p>
    </div>
  );
}

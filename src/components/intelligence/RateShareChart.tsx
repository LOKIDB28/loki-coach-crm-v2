"use client";

import type { ReactNode } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { rateColor } from "@/lib/domain";
import { CHART_TOOLTIP_STYLE, COLORS } from "@/lib/theme";
import type { Deal } from "@/lib/types";

interface RateShareChartProps {
  title: string;
  description: string;
  deals: Pick<Deal, "rate_percent">[];
  totalDeals: number;
}

/**
 * Pie chart of deals grouped by rate_percent - built from whatever `deals`
 * the caller already filtered (all with a rate, or the >=10% subset), never
 * a hardcoded bucket list, so a value with 0 real deals just doesn't
 * appear (no empty/misleading slice).
 */
export function RateShareChart({ title, description, deals, totalDeals }: RateShareChartProps) {
  const counts = new Map<number, number>();
  for (const d of deals) {
    if (d.rate_percent === null) continue;
    counts.set(d.rate_percent, (counts.get(d.rate_percent) ?? 0) + 1);
  }
  const data = [...counts.entries()]
    .map(([value, count]) => ({ value, label: `${value}%`, count }))
    .sort((a, b) => a.value - b.value);
  const shown = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text mb-1">{title}</h2>
      <p className="text-xs text-textSoft mb-4">{description}</p>

      {data.length === 0 ? (
        <p className="text-sm text-textSoft py-10 text-center">Aucun deal ne correspond à ce filtre.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={50} outerRadius={95} paddingAngle={1}>
              {data.map((d) => (
                <Cell key={d.value} fill={rateColor(d.value)} stroke="rgb(var(--surface))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: unknown, name: unknown) =>
                [
                  <span key="v">
                    <span style={{ color: COLORS.orange, fontWeight: 700 }}>{value as ReactNode}</span> deals
                  </span>,
                  name,
                ] as [ReactNode, ReactNode]
              }
            />
            {/* No on-chart labels - with several thin adjacent slices (8/10/15/20%),
                recharts' default label placement overlapped (reported: 0%/1%).
                The legend shows the same count+percentage per slice with zero
                collision risk, regardless of how many thin slices there are. */}
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value, entry) => {
                const count = (entry?.payload as unknown as { count: number } | undefined)?.count ?? 0;
                const pct = shown > 0 ? Math.round((count / shown) * 100) : 0;
                return (
                  <span style={{ color: "rgb(var(--text-soft))" }}>
                    {value} — {count} ({pct}%)
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-textSoft mt-2">
        Basé sur {shown} deal{shown > 1 ? "s" : ""} sur {totalDeals} ayant un taux enregistré.
      </p>
    </div>
  );
}

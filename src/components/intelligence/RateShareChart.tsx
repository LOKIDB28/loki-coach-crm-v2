"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { rateColor } from "@/lib/domain";
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
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={50}
              outerRadius={95}
              paddingAngle={1}
              label={({ name, percent }) => `${name} (${Math.round((percent ?? 0) * 100)}%)`}
              labelLine={{ stroke: "rgb(var(--border) / 0.4)" }}
            >
              {data.map((d) => (
                <Cell key={d.value} fill={rateColor(d.value)} stroke="rgb(var(--surface))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [`${value} deals`, name] as [string, string]}
              contentStyle={{
                background: "rgb(var(--surface))",
                border: "1px solid rgb(var(--border) / 0.2)",
                borderRadius: 8,
                fontSize: 12,
                color: "rgb(var(--text))",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "rgb(var(--text-soft))" }}
              formatter={(value) => <span style={{ color: "rgb(var(--text-soft))" }}>{value}</span>}
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

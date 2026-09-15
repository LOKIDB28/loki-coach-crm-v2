"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { assignCategoricalColors } from "@/lib/domain";
import type { SourceBreakdownRow } from "@/lib/types";

interface SourceBreakdownChartProps {
  data: SourceBreakdownRow[];
}

/** public.v_sources, already sorted by nb_deals desc. */
export function SourceBreakdownChart({ data }: SourceBreakdownChartProps) {
  const colors = assignCategoricalColors(data.map((d) => d.source));
  return (
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
          dataKey="source"
          width={110}
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
        <Bar dataKey="nb_deals" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.source} fill={colors.get(d.source)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS } from "@/lib/theme";
import type { PipelineStage } from "@/lib/types";

interface PipelineFunnelChartProps {
  stages: PipelineStage[];
  counts: Record<number, number>;
}

/** Deal count per stage, ordered by pipeline position - same counts PipelineBar shows. */
export function PipelineFunnelChart({ stages, counts }: PipelineFunnelChartProps) {
  const data = [...stages]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ label: s.label, code: s.code, count: counts[s.id] ?? 0 }));

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
          dataKey="label"
          width={100}
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
            <Cell key={d.code} fill={d.code === "gagne" ? COLORS.green : d.code === "perdu" ? COLORS.stone : COLORS.teal} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

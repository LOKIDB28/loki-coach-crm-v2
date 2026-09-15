"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { assignCategoricalColors } from "@/lib/domain";
import { CHART_TOOLTIP_STYLE, COLORS } from "@/lib/theme";

interface ProvinceBarChartProps {
  data: { province: string; count: number }[];
}

const MAX_ROWS = 10;

/**
 * Top provinces/states by contact count, real "Autres" bucket for the long
 * tail rather than a chart that scrolls forever. City-level geocoding isn't
 * possible here - contacts.ville holds free-text regions ("Edmonton /
 * Northern Alberta"), not clean city names, so this stays province-level.
 */
export function ProvinceBarChart({ data }: ProvinceBarChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, MAX_ROWS);
  const restCount = sorted.slice(MAX_ROWS).reduce((sum, d) => sum + d.count, 0);
  const chartData = restCount > 0 ? [...top, { province: "Autres", count: restCount }] : top;
  const colors = assignCategoricalColors(chartData.map((d) => d.province));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
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
          dataKey="province"
          width={90}
          tick={{ fill: "rgb(var(--text))", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value: unknown, name: unknown) =>
            [
              <span key="v" style={{ color: COLORS.orange, fontWeight: 700 }}>
                {value as ReactNode}
              </span>,
              name,
            ] as [ReactNode, ReactNode]
          }
          cursor={{ fill: "rgb(var(--border) / 0.08)" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((d) => (
            <Cell key={d.province} fill={colors.get(d.province)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

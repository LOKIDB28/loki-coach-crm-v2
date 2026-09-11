"use client";

import { INTERETS } from "@/lib/domain";
import type { Client, Profile } from "@/lib/types";

interface RecapTableProps {
  clients: Client[];
  profiles: Profile[];
}

const NON_ASSIGNE = "__non_assigne__";

/**
 * Recap matrix: rows = each team member (+ "Non assigné"), columns = each
 * niveau d'intérêt, cell = count, plus a totals row and column. Computed
 * live from the clients currently loaded (same shape as the prototype's
 * toggleable recap table).
 */
export function RecapTable({ clients, profiles }: RecapTableProps) {
  const rows: { key: string; label: string }[] = [
    ...profiles.map((p) => ({ key: p.id, label: p.nom || p.email || "Sans nom" })),
    { key: NON_ASSIGNE, label: "Non assigné" },
  ];

  const grid: Record<string, Record<string, number>> = {};
  function rowFor(key: string): Record<string, number> {
    let existing = grid[key];
    if (!existing) {
      existing = {};
      for (const interet of INTERETS) existing[interet.v] = 0;
      grid[key] = existing;
    }
    return existing;
  }
  for (const row of rows) rowFor(row.key);

  for (const c of clients) {
    const rowKey = c.owner_id ?? NON_ASSIGNE;
    const gridRow = rowFor(rowKey);
    const col = c.niveau_interet;
    if (col && gridRow[col] !== undefined) {
      gridRow[col] += 1;
    }
  }

  const rowTotal = (key: string) =>
    INTERETS.reduce((sum, i) => sum + (grid[key]?.[i.v] ?? 0), 0);
  const colTotal = (interet: string) =>
    rows.reduce((sum, r) => sum + (grid[r.key]?.[interet] ?? 0), 0);
  const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r.key), 0);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="bg-surface2">
            <th className="text-left font-heading text-[11px] uppercase tracking-wide text-textSoft px-3 py-2">
              Représentant
            </th>
            {INTERETS.map((i) => (
              <th
                key={i.v}
                className="text-right font-heading text-[11px] uppercase tracking-wide text-textSoft px-3 py-2"
              >
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: i.c }}
                  />
                  {i.v}
                </span>
              </th>
            ))}
            <th className="text-right font-heading text-[11px] uppercase tracking-wide text-brassSoft px-3 py-2">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-3 py-2 text-text">{row.label}</td>
              {INTERETS.map((i) => (
                <td key={i.v} className="px-3 py-2 text-right tabular-nums text-textSoft">
                  {grid[row.key]?.[i.v] ?? 0}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-brassSoft">
                {rowTotal(row.key)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border bg-surface2">
            <td className="px-3 py-2 font-heading uppercase tracking-wide text-xs text-textSoft">
              Total
            </td>
            {INTERETS.map((i) => (
              <td
                key={i.v}
                className="px-3 py-2 text-right tabular-nums font-semibold text-text"
              >
                {colTotal(i.v)}
              </td>
            ))}
            <td className="px-3 py-2 text-right tabular-nums font-bold text-brassSoft">
              {grandTotal}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

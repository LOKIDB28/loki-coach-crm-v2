"use client";

import type { ReportPeriod } from "@/lib/report";

interface PeriodSelectorProps {
  period: ReportPeriod | null;
  customStart: string;
  customEnd: string;
  loading: boolean;
  /** "semaine"/"mois" generate immediately; "custom" only reveals the two date inputs below - see onCustomSubmit. */
  onSelect: (period: ReportPeriod) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onCustomSubmit: () => void;
}

const OPTIONS: { key: ReportPeriod; label: string }[] = [
  { key: "semaine", label: "Cette semaine" },
  { key: "mois", label: "Ce mois" },
  { key: "custom", label: "Dates personnalisées" },
];

export function PeriodSelector({
  period,
  customStart,
  customEnd,
  loading,
  onSelect,
  onCustomStartChange,
  onCustomEndChange,
  onCustomSubmit,
}: PeriodSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={loading}
            onClick={() => onSelect(opt.key)}
            className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${
              period === opt.key
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-border/20 text-textSoft hover:text-text hover:border-teal/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-textSoft">
            Du
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="block mt-1 text-sm px-2.5 py-1.5 rounded-lg border border-border/20 bg-surface text-text"
            />
          </label>
          <label className="text-xs text-textSoft">
            Au
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="block mt-1 text-sm px-2.5 py-1.5 rounded-lg border border-border/20 bg-surface text-text"
            />
          </label>
          <button
            type="button"
            disabled={loading || !customStart || !customEnd}
            onClick={onCustomSubmit}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-teal text-white hover:bg-teal/90 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          >
            Calculer
          </button>
        </div>
      )}
    </div>
  );
}

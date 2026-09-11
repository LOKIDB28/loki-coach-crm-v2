"use client";

import { STAGES } from "@/lib/domain";

interface PipelineBarProps {
  counts: Record<number, number>;
  activeStage: number | null;
  onSelectStage: (stage: number | null) => void;
}

/** 6-stage horizontal pipeline bar with per-stage counts, clickable to filter. */
export function PipelineBar({ counts, activeStage, onSelectStage }: PipelineBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {STAGES.map((stage) => {
        const Icon = stage.icon;
        const isActive = activeStage === stage.id;
        const count = counts[stage.id] ?? 0;
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(isActive ? null : stage.id)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors ${
              isActive
                ? "border-brass bg-brass/15"
                : "border-border bg-surface hover:border-brass/50"
            }`}
          >
            <Icon
              size={16}
              strokeWidth={1.75}
              className={isActive ? "text-brass" : "text-textSoft"}
            />
            <div className="flex-1 min-w-0">
              <div
                className={`font-heading text-[11px] uppercase tracking-wide truncate ${
                  isActive ? "text-brassSoft" : "text-textSoft"
                }`}
              >
                {stage.code} · {stage.label}
              </div>
            </div>
            <span
              className={`font-heading text-sm tabular-nums ${
                isActive ? "text-brassSoft" : "text-text"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

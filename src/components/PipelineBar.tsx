"use client";

import { stageIcon } from "@/lib/domain";
import type { PipelineStage } from "@/lib/types";

interface PipelineBarProps {
  stages: PipelineStage[];
  counts: Record<number, number>;
  activeStage: number | null;
  onSelectStage: (stage: number | null) => void;
}

/** Pipeline bar with per-stage counts, clickable to filter. Stages are live data from public.pipeline_stages. */
export function PipelineBar({ stages, counts, activeStage, onSelectStage }: PipelineBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {stages.map((stage) => {
        const Icon = stageIcon(stage.code);
        const isActive = activeStage === stage.id;
        const count = counts[stage.id] ?? 0;
        const isWon = stage.code === "gagne";
        const isLost = stage.code === "perdu";
        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(isActive ? null : stage.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
              isActive
                ? isWon
                  ? "border-green bg-green/15"
                  : "border-teal bg-teal/10"
                : "border-border/15 bg-surface hover:border-teal/40"
            }`}
          >
            <Icon
              size={16}
              strokeWidth={1.75}
              className={isActive ? (isWon ? "text-green" : "text-teal") : isLost ? "text-textSoft/60" : "text-textSoft"}
            />
            <div className="flex-1 min-w-0">
              <div
                className={`text-[11px] font-medium truncate ${
                  isActive ? (isWon ? "text-green" : "text-teal") : "text-textSoft"
                }`}
              >
                {stage.label}
              </div>
            </div>
            <span className={`text-sm tabular-nums font-medium ${isActive ? "text-text" : "text-text"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

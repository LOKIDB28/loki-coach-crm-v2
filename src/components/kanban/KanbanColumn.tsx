"use client";

import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import type { DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface KanbanColumnProps {
  stage: PipelineStage;
  deals: DealWithContact[];
  profileById: Map<string, Profile>;
  dupeClientIds: Set<string>;
  dupeCoachIds: Set<string>;
  onOpen: (id: string) => void;
}

/**
 * Pass 1: every deal in this stage renders directly, no incremental
 * loading - Prospect alone is ~290 cards today. That's deliberate for this
 * pass (agreed: validate the drag gesture itself first, harden after) and
 * will feel it - incremental loading is the very next pass, not skipped.
 */
export function KanbanColumn({ stage, deals, profileById, dupeClientIds, dupeCoachIds, onOpen }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}`, data: { stageId: stage.id } });

  return (
    <div className="flex flex-col w-[280px] shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold text-text truncate">{stage.label}</h3>
        <span className="text-xs font-medium text-textSoft tabular-nums shrink-0 ml-2">{deals.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[160px] max-h-[calc(100vh-320px)] overflow-y-auto rounded-xl border p-2 space-y-2.5 transition-colors ${
          isOver ? "border-teal/50 bg-teal/5" : "border-border/15 bg-surface2/40"
        }`}
      >
        {deals.length === 0 ? (
          <p className="text-xs text-textSoft text-center py-8">Aucun dossier</p>
        ) : (
          deals.map((d) => (
            <KanbanCard
              key={d.id}
              deal={d}
              stage={stage}
              ownerName={d.owner_id ? profileById.get(d.owner_id)?.nom ?? profileById.get(d.owner_id)?.email ?? null : null}
              hasClientDupe={dupeClientIds.has(d.id)}
              hasCoachDupe={dupeCoachIds.has(d.id)}
              onOpen={() => onOpen(d.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

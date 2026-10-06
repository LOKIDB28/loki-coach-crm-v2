"use client";

import { useDroppable } from "@dnd-kit/core";
import { DealHoverContent } from "@/components/DealHoverContent";
import { HoverTooltip } from "@/components/HoverTooltip";
import { KanbanCard } from "./KanbanCard";
import type { DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface KanbanColumnProps {
  stage: PipelineStage;
  deals: DealWithContact[];
  profileById: Map<string, Profile>;
  dupeClientIds: Set<string>;
  dupeCoachIds: Set<string>;
  stageEntryByDeal: Map<string, string>;
  lastActivityByDeal: Map<string, string>;
  onOpen: (id: string) => void;
}

/**
 * Pass 1: every deal in this stage renders directly, no incremental
 * loading - Prospect alone is ~290 cards today. That's deliberate for this
 * pass (agreed: validate the drag gesture itself first, harden after) and
 * will feel it - incremental loading is the very next pass, not skipped.
 */
export function KanbanColumn({
  stage,
  deals,
  profileById,
  dupeClientIds,
  dupeCoachIds,
  stageEntryByDeal,
  lastActivityByDeal,
  onOpen,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}`, data: { stageId: stage.id } });

  return (
    <div className="flex flex-col w-[280px] shrink-0">
      {/* Bottom hairline separates this from the scrollable body below it -
          this header sits outside that body's own overflow-y-auto (see the
          sibling div below), so it already never scrolled with the cards;
          the separator just makes that fixed-in-place relationship legible
          instead of the two blending into one visual block. Count in a
          pill (bg-surface2), same "badge" language DealCard already uses
          elsewhere, for faster scanning than bare trailing text. */}
      <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-border/10">
        <h3 className="text-sm font-semibold text-text truncate">{stage.label}</h3>
        <span className="text-xs font-semibold text-textSoft bg-surface2 rounded-full px-2 py-0.5 tabular-nums shrink-0 ml-2">
          {deals.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        // `border` (1px) stays on both branches - only its color/style
        // (solid/dashed) changes between them, never its width, so the
        // drop state introduces zero layout shift. Padding 10px (was 8px):
        // DealCard's own hover lift (-translate-y-3px) + shadow-md + 2px
        // focus ring need that much room so they're never clipped by this
        // container's rounded-xl + overflow-y-auto at the first/last
        // visible card. transition-colors is already covered by the
        // blanket prefers-reduced-motion rule in globals.css (Lot 1) - no
        // extra override needed here.
        className={`flex-1 min-h-[160px] max-h-[calc(100vh-320px)] overflow-y-auto rounded-xl border p-2.5 space-y-2.5 transition-colors ${
          isOver ? "border-dashed border-teal/50 bg-teal/5" : "border-solid border-border/15 bg-surface2/40"
        }`}
      >
        {deals.length === 0 ? (
          isOver ? (
            // Simplified on purpose while a drag is over an empty column -
            // the dashed/tinted treatment above already carries the "drop
            // here" signal; stacking a second dashed box inside it would
            // just compete with that instead of reinforcing it.
            <p className="text-xs text-textSoft text-center py-10">Aucun dossier</p>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-full py-10 border border-dashed border-border/15 rounded-lg text-xs text-textSoft">
              <span className="w-1.5 h-1.5 rounded-full bg-border/30" />
              Aucun dossier
            </div>
          )
        ) : (
          deals.map((d) => (
            <HoverTooltip
              key={d.id}
              content={
                <DealHoverContent
                  deal={d}
                  stageEnteredAt={stageEntryByDeal.get(d.id)}
                  lastActivityAt={lastActivityByDeal.get(d.id)}
                />
              }
            >
              <KanbanCard
                deal={d}
                stage={stage}
                ownerName={d.owner_id ? profileById.get(d.owner_id)?.nom ?? profileById.get(d.owner_id)?.email ?? null : null}
                hasClientDupe={dupeClientIds.has(d.id)}
                hasCoachDupe={dupeCoachIds.has(d.id)}
                onOpen={() => onOpen(d.id)}
              />
            </HoverTooltip>
          ))
        )}
      </div>
    </div>
  );
}

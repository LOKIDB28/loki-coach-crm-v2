"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { DealCard } from "@/components/DealCard";
import { KanbanColumn } from "./KanbanColumn";
import type { DealWithContact, PipelineStage, Profile } from "@/lib/types";

interface KanbanBoardProps {
  /** Already filtered by owner/search (not by stage - stage is the columns themselves). */
  deals: DealWithContact[];
  /** Must be stages.filter(s => s.is_open) - see the note below. */
  openStages: PipelineStage[];
  profileById: Map<string, Profile>;
  dupeClientIds: Set<string>;
  dupeCoachIds: Set<string>;
  onOpen: (id: string) => void;
  onMoveDeal: (dealId: string, newStageId: number) => void;
}

/**
 * Columns are built only from the open stages passed in - gagne/perdu never
 * get a droppable id registered anywhere in this tree, so there's no drop
 * target dnd-kit could resolve a card onto even by accident. That's not a
 * visual-only restriction: reaching gagne/perdu stays exclusively through
 * DealDrawer's confirmed "Marquer gagné"/"Marquer perdu" buttons, same as
 * before this board existed.
 *
 * Pass 1 only: no manual intra-column order exists on deals (no `position`
 * field), so this uses plain @dnd-kit/core drag/drop rather than
 * @dnd-kit/sortable - there's nothing to reorder, only a stage to change on
 * a cross-column drop. Dropping back into the same column is a no-op.
 */
export function KanbanBoard({
  deals,
  openStages,
  profileById,
  dupeClientIds,
  dupeCoachIds,
  onOpen,
  onMoveDeal,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const dealsByStage = new Map<number, DealWithContact[]>();
  for (const stage of openStages) dealsByStage.set(stage.id, []);
  for (const d of deals) {
    dealsByStage.get(d.stage_id)?.push(d);
  }
  const stageById = new Map(openStages.map((s) => [s.id, s]));
  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const stageId = over.data.current?.stageId as number | undefined;
    if (stageId === undefined) return;
    const deal = deals.find((d) => d.id === active.id);
    if (!deal || deal.stage_id === stageId) return;
    onMoveDeal(deal.id, stageId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {openStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage.get(stage.id) ?? []}
            profileById={profileById}
            dupeClientIds={dupeClientIds}
            dupeCoachIds={dupeCoachIds}
            onOpen={onOpen}
          />
        ))}
      </div>

      {/* Portaled outside every column's overflow-y-auto clipping, so the
          dragged card stays visible under the cursor for the whole
          gesture instead of disappearing the moment it crosses its
          source column's boundary (see KanbanCard for the full story). */}
      <DragOverlay>
        {activeDeal ? (
          <div className="w-[280px] rotate-1 shadow-xl">
            <DealCard
              deal={activeDeal}
              stage={stageById.get(activeDeal.stage_id)}
              ownerName={
                activeDeal.owner_id
                  ? profileById.get(activeDeal.owner_id)?.nom ?? profileById.get(activeDeal.owner_id)?.email ?? null
                  : null
              }
              hasClientDupe={dupeClientIds.has(activeDeal.id)}
              hasCoachDupe={dupeCoachIds.has(activeDeal.id)}
              onOpen={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

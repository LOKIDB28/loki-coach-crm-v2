"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DealCard } from "@/components/DealCard";
import type { DealWithContact, PipelineStage } from "@/lib/types";

interface KanbanCardProps {
  deal: DealWithContact;
  stage: PipelineStage | undefined;
  ownerName: string | null;
  hasClientDupe: boolean;
  hasCoachDupe: boolean;
  onOpen: () => void;
}

/**
 * Thin drag wrapper around the existing DealCard - DealCard itself is
 * unchanged, so the relance badge and dupe warnings it already renders
 * carry over identically here. Listeners/attributes go on this outer div,
 * not on DealCard's own <button>, so a plain click still opens the drawer
 * normally: the board's PointerSensor has an 8px activation distance (see
 * KanbanBoard), so a click that never moves 8px never becomes a drag in
 * the first place and the button's onClick fires as usual.
 */
export function KanbanCard({ deal, stage, ownerName, hasClientDupe, hasCoachDupe, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? "opacity-50 z-10 relative" : ""}`}
    >
      <DealCard
        deal={deal}
        stage={stage}
        ownerName={ownerName}
        hasClientDupe={hasClientDupe}
        hasCoachDupe={hasCoachDupe}
        onOpen={onOpen}
      />
    </div>
  );
}

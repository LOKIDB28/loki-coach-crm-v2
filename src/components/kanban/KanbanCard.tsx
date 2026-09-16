"use client";

import { useDraggable } from "@dnd-kit/core";
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
 *
 * Deliberately does NOT apply `transform` to this node while dragging - an
 * earlier version did, which visually moved the real card, but every
 * column scrolls internally (overflow-y-auto), and a translated child gets
 * clipped the moment it's dragged past its own column's box: the card
 * appeared to vanish under the cursor. KanbanBoard's <DragOverlay> now
 * renders the actual moving copy, portaled outside every column's overflow
 * clipping - this node just stays put as a dimmed placeholder marking
 * where the card came from.
 */
export function KanbanCard({ deal, stage, ownerName, hasClientDupe, hasCoachDupe, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`touch-none ${isDragging ? "opacity-30" : ""}`}>
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

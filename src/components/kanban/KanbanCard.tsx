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
 * normally: mouse clicks are gated by an 8px activation distance and touch
 * taps by TouchSensor's delay/tolerance (see KanbanBoard) - neither fires
 * for a gesture that never crosses those thresholds, so the button's
 * onClick fires as usual.
 *
 * Deliberately does NOT apply `transform` to this node while dragging - an
 * earlier version did, which visually moved the real card, but every
 * column scrolls internally (overflow-y-auto), and a translated child gets
 * clipped the moment it's dragged past its own column's box: the card
 * appeared to vanish under the cursor. KanbanBoard's <DragOverlay> now
 * renders the actual moving copy, portaled outside every column's overflow
 * clipping - this node just stays put as a dimmed placeholder marking
 * where the card came from.
 *
 * touch-manipulation, not touch-none: `touch-action: none` tells the
 * browser to never hand this element's touch gestures to native
 * scrolling at all, which defeated TouchSensor's delay entirely (a fast
 * flick had no native scroll to fall through to, delay or not). manipulation
 * still permits panning/scrolling; TouchSensor's own JS-level delay is what
 * decides whether a given gesture becomes a drag instead.
 */
export function KanbanCard({ deal, stage, ownerName, hasClientDupe, hasCoachDupe, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // After the attributes spread, not before: useDraggable's own
      // {...attributes} includes tabIndex={0} (for a keyboard-drag flow
      // that was never wired up - KanbanBoard only configures Mouse/
      // TouchSensor, no KeyboardSensor), which made this wrapper a second,
      // functionally dead tab stop sitting right in front of DealCard's
      // own button - tabbing a Kanban card showed the same focus ring
      // twice in a row for what looked like one card. -1 here removes it
      // from the tab order without touching the mouse/touch drag
      // listeners above, which don't depend on focusability at all.
      tabIndex={-1}
      className={`touch-manipulation rounded-xl ${isDragging ? "opacity-30" : ""}`}
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

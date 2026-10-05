"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HOVER_TOOLTIP_BG } from "@/lib/theme";

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
}

const SHOW_DELAY_MS = 400;
const GAP_PX = 6;
const ARROW_LEFT_OFFSET_PX = 18;
// A rough estimate, used only to decide whether to flip above instead of
// below - the actual attached edge is always exact regardless of how good
// this guess is (see the translateY(-100%) comment below), so this never
// needs to track the real content precisely.
const ESTIMATED_HEIGHT_PX = 90;
// DealCard's own :hover state lifts it 3px (hover:-translate-y-[3px]) -
// that transform is applied to the card's own element, somewhere inside
// {children} (through an extra KanbanCard wrapper div in the Kanban case),
// never to this component's own wrapper div. getBoundingClientRect() on an
// element never reflects a transform applied to one of its descendants -
// a transform doesn't affect an ancestor's layout box, by spec - so
// measuring the wrapper always reports the pre-lift position. Confirmed by
// hovering an archived card (opacity-only, no hover-lift) right next to a
// regular one and measuring both: the archived card's gap matched GAP_PX
// exactly, every other card's was 3px off. Baking in the known, fixed lift
// amount directly is simpler and more robust than finding and measuring
// whichever nested element actually carries the transform - the nesting
// depth differs between a plain Pipeline card and a Kanban-wrapped one,
// but the lift amount doesn't.
const CARD_HOVER_LIFT_PX = 3;

interface Coords {
  top: number;
  left: number;
  width: number;
  flip: boolean;
}

/**
 * Generic hover-to-reveal tooltip, desktop only - deliberately checks
 * `(hover: hover) and (pointer: fine)` rather than a screen-width
 * breakpoint, since hover capability (not screen size) is what makes a
 * tooltip usable at all: a touch device has no hover event to trigger it
 * and no cursor to place it near, so it never attaches the listeners in
 * the first place. No long-press fallback for this first version - tap
 * still opens the existing drawer, unchanged.
 *
 * Renders via a portal to document.body rather than a plain absolutely-
 * positioned child: callers live inside Kanban columns, which scroll
 * internally (overflow-y-auto) - an in-place absolute child gets clipped
 * at the column's edge the same way KanbanCard's DragOverlay comment
 * describes for the drag preview. Position is computed from the
 * triggering element's own getBoundingClientRect() on show, in `fixed`
 * coordinates (so it isn't affected by any ancestor's scroll position) -
 * always exactly as wide as the card and aligned to its left edge, flipping
 * above the card when there isn't room below.
 */
export function HoverTooltip({ content, children }: HoverTooltipProps) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapableRef = useRef(false);

  useEffect(() => {
    hoverCapableRef.current =
      typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Closes rather than repositions on scroll - simpler and more robust than
  // re-measuring live against whichever of several possible scroll
  // containers moved (the window itself, a Kanban column's own
  // overflow-y-auto, or the drawer's) - capture:true so this fires for
  // all of them, not just a window-level scroll.
  useEffect(() => {
    if (!coords) return;
    function handleScroll() {
      setCoords(null);
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [coords]);

  function handleMouseEnter() {
    if (!hoverCapableRef.current) return;
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const liftedTop = rect.top - CARD_HOVER_LIFT_PX;
      const liftedBottom = rect.bottom - CARD_HOVER_LIFT_PX;
      const flip = liftedBottom + GAP_PX + ESTIMATED_HEIGHT_PX > window.innerHeight;
      setCoords({
        // Flip case anchors `top` just above the gap, then the
        // translateY(-100%) below shifts the box up by its own real
        // rendered height - the attached (bottom) edge lands exactly at
        // this `top` value regardless of how accurate ESTIMATED_HEIGHT_PX
        // was, so only the flip go/no-go decision above is an estimate,
        // never the actual attachment.
        top: flip ? liftedTop - GAP_PX : liftedBottom + GAP_PX,
        left: rect.left,
        width: rect.width,
        flip,
      });
    }, SHOW_DELAY_MS);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCoords(null);
  }

  return (
    // self-start: DealGrid's container is a CSS grid with the default
    // align-items: stretch - without this, this wrapper (the grid item
    // itself, with no intermediate element) stretches to match the
    // tallest card in its row, so getBoundingClientRect() on it reports
    // that stretched row height instead of the visible card's own edge
    // for every shorter card sharing a row with a taller one. Confirmed
    // empirically: a card with 2 extra detail lines (height 183px) sharing
    // a row with one showing only 1 (135px) pushed the shorter card's
    // tooltip 48px (the height difference) too far down before this.
    <div ref={wrapperRef} className="self-start" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {coords &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[1600]"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.flip ? "translateY(-100%)" : undefined,
            }}
          >
            {/* Small diamond, same color as the tooltip body, connecting it
                to the card - below the card points up (sits at the box's
                own top edge), above the card points down (sits at its
                bottom edge). */}
            <div
              className="absolute w-[11px] h-[11px] rotate-45"
              style={{
                backgroundColor: HOVER_TOOLTIP_BG,
                left: ARROW_LEFT_OFFSET_PX,
                ...(coords.flip ? { bottom: -4 } : { top: -4 }),
              }}
            />
            <div
              className="relative rounded-lg p-3 text-xs text-white leading-relaxed"
              style={{
                backgroundColor: HOVER_TOOLTIP_BG,
                boxShadow: "0 12px 24px -10px rgb(0 0 0 / 0.35), 0 4px 10px -4px rgb(0 0 0 / 0.25)",
              }}
            >
              {content}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

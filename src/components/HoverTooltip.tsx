"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
}

const SHOW_DELAY_MS = 400;
const GAP_PX = 8;

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
 * coordinates (so it isn't affected by any ancestor's scroll position),
 * flipping above the element when there isn't room below.
 */
export function HoverTooltip({ content, children }: HoverTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; flip: boolean } | null>(null);
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

  function handleMouseEnter() {
    if (!hoverCapableRef.current) return;
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = 120;
      const flip = rect.bottom + estimatedHeight + GAP_PX > window.innerHeight;
      setCoords({
        top: flip ? rect.top - GAP_PX : rect.bottom + GAP_PX,
        left: Math.min(rect.left, window.innerWidth - 288 - 16),
        flip,
      });
      setVisible(true);
    }, SHOW_DELAY_MS);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  return (
    <div ref={wrapperRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible &&
        coords &&
        createPortal(
          <div
            className="fixed w-72 max-w-[80vw] rounded-lg border border-border/15 bg-surface shadow-lg p-3 text-xs text-textSoft leading-relaxed z-[1600] pointer-events-none"
            style={{ top: coords.top, left: coords.left, transform: coords.flip ? "translateY(-100%)" : undefined }}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}

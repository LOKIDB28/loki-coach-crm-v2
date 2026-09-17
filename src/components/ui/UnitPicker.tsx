"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

const MIN_UNIT = 15;
const MAX_UNIT = 100;
const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5; // odd, so one row sits exactly on the center
const PAD_ROWS = Math.floor(VISIBLE_ITEMS / 2);

function formatUnit(n: number): string {
  return `LC${String(n).padStart(3, "0")}`;
}

interface UnitPickerProps {
  /** Current deals.numero_unite_libre value, or null if unset. */
  value: string | null;
  onChange: (value: string) => void;
}

/**
 * iOS-style scroll picker for LC015-LC100, built entirely on native CSS
 * scroll-snap - no animation library. scroll-snap hands the momentum/easing
 * to the browser/OS itself, which is arguably more authentically "native
 * picker" feeling than a JS-driven equivalent, and it already works via
 * touch (mobile/tablet) and mouse wheel (desktop) with zero extra code.
 * The only gap native scrolling leaves on desktop is click-and-drag with a
 * mouse (an overflow:auto div doesn't scroll on drag by itself), covered
 * below with a small pointer-event handler - restricted to pointerType
 * "mouse" so it never fights the native touch-scroll on mobile (the same
 * class of bug fixed in the kanban board's touch handling).
 *
 * Mount-safe: positions to the current value without ever calling
 * onChange - only an actual user gesture (drag, wheel, key, or tapping a
 * row) arms `hasInteracted`, so simply opening a deal never silently marks
 * this field dirty.
 */
export function UnitPicker({ value, onChange }: UnitPickerProps) {
  const values = useMemo(() => {
    const arr: string[] = [];
    for (let n = MIN_UNIT; n <= MAX_UNIT; n++) arr.push(formatUnit(n));
    return arr;
  }, []);

  // A value outside LC015-LC100 (there's no such data today, but nothing
  // stops a future free-text entry from predating this picker) falls back
  // to index 0 rather than crashing - the mount-safe guard below means
  // that never silently overwrites the real stored value on save.
  const initialIndex = Math.max(0, value ? values.indexOf(value) : 0);
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ startY: number; startScrollTop: number } | null>(null);

  // Position on mount, before paint, so there's no visible jump - and
  // deliberately not in a [value] effect: the parent remounts this
  // component (key={deal.id}) when switching deals, which is the only time
  // this should ever reposition.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = initialIndex * ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitIfInteracted(idx: number) {
    // idx always arrives pre-clamped to [0, values.length - 1] by the caller.
    if (hasInteracted.current) onChange(values[idx]!);
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
    setCenteredIndex(idx);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => commitIfInteracted(idx), 120);
  }

  function scrollToIndex(idx: number) {
    hasInteracted.current = true;
    containerRef.current?.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // touch keeps pure native scroll
    hasInteracted.current = true;
    const el = containerRef.current;
    if (!el) return;
    drag.current = { startY: e.clientY, startScrollTop: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || !containerRef.current) return;
    containerRef.current.scrollTop = drag.current.startScrollTop - (e.clientY - drag.current.startY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    containerRef.current?.releasePointerCapture(e.pointerId);
    // Snap to the nearest row after a manual drag - scroll-snap only
    // engages for scroll-driven momentum, not a direct scrollTop write.
    containerRef.current?.scrollTo({ top: centeredIndex * ITEM_HEIGHT, behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      scrollToIndex(Math.min(values.length - 1, centeredIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      scrollToIndex(Math.max(0, centeredIndex - 1));
    }
  }

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* Selection slot indicator - purely visual, sits behind the centered row. */}
      <div
        className="absolute left-0 right-0 border-y border-teal/25 bg-teal/5 pointer-events-none rounded-md"
        style={{ top: PAD_ROWS * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        role="listbox"
        tabIndex={0}
        aria-label="Numéro d'unité"
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={() => {
          hasInteracted.current = true;
        }}
        onKeyDown={handleKeyDown}
        className="h-full overflow-y-auto no-scrollbar cursor-grab active:cursor-grabbing focus:outline-none"
        style={{
          scrollSnapType: "y mandatory",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
          maskImage: "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
        }}
      >
        <div style={{ height: PAD_ROWS * ITEM_HEIGHT }} />
        {values.map((v, idx) => (
          <div
            key={v}
            role="option"
            aria-selected={idx === centeredIndex}
            onClick={() => scrollToIndex(idx)}
            className={`flex items-center justify-center text-sm transition-all duration-100 select-none ${
              idx === centeredIndex ? "text-teal font-semibold text-base" : "text-textSoft"
            }`}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
          >
            {v}
          </div>
        ))}
        <div style={{ height: PAD_ROWS * ITEM_HEIGHT }} />
      </div>
    </div>
  );
}

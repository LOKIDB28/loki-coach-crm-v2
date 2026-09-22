"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface WidgetInfoTooltipProps {
  children: ReactNode;
}

/**
 * Small "*" button, one per LOKI Intelligence widget, revealing a
 * click-to-open explanation of what the widget measures/how it's
 * calculated/how to read it. Deliberately separate from the critical
 * warnings already inline on some widgets (e.g. "deals ouverts, pas des
 * ventes conclues") - those stay always-visible, this is a supplementary,
 * more detailed layer, never a replacement. One shared component so the
 * popover behavior (position, dismiss-on-outside-click) lives in exactly
 * one place instead of being re-implemented per widget - only the
 * explanation text differs between call sites.
 */
export function WidgetInfoTooltip({ children }: WidgetInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    // z-[1500]/z-[1600] (not Tailwind's default z-10/z-20 scale, which
    // tops out at z-50) - the province map widget renders a Leaflet map as
    // a sibling here, and Leaflet's own panes/controls go up to z-index
    // 1000 (leaflet.css: .leaflet-tooltip-pane 650, .leaflet-popup-pane
    // 700, .leaflet-top/.leaflet-bottom controls 1000) - confirmed by
    // reading the installed package's CSS, not guessed. Both the trigger
    // button and the popover need to clear that, not just the popover:
    // .leaflet-container doesn't establish its own stacking context
    // (position: relative alone doesn't, without a z-index), so its
    // high-z-index descendants compete directly with this component's in
    // the same shared context and would otherwise render on top of - and
    // block clicks on - the button itself, not just visually cover the
    // popover text.
    <div ref={ref} className="absolute top-3 right-3 z-[1500]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Explication de ce widget"
        aria-expanded={open}
        className="flex items-center justify-center w-5 h-5 rounded-full text-textSoft/60 hover:text-teal hover:bg-surface2 transition-colors duration-150 text-sm leading-none font-serif"
      >
        *
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 max-w-[80vw] rounded-lg border border-border/15 bg-surface shadow-lg p-3 text-xs text-textSoft leading-relaxed z-[1600]">
          {children}
        </div>
      )}
    </div>
  );
}

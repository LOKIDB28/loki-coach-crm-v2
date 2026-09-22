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
    <div ref={ref} className="absolute top-3 right-3 z-10">
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
        <div className="absolute right-0 mt-1 w-72 max-w-[80vw] rounded-lg border border-border/15 bg-surface shadow-lg p-3 text-xs text-textSoft leading-relaxed z-20">
          {children}
        </div>
      )}
    </div>
  );
}

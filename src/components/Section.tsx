"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionProps {
  code: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  active?: boolean;
  children: ReactNode;
}

/** Collapsible per-stage block used in the deal detail drawer, one per pipeline stage. */
export function Section({ code, title, icon: Icon, defaultOpen = false, active = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border transition-colors duration-200 ${
        // 0.01, not the original 0.04 - now that DealDrawer's own panel is
        // opaque (see globals.css's .glass-scrim/.glass-bar comment), this
        // tint composites directly against a known, solid background
        // instead of glass. Measured (fictional data, both themes): 0.04
        // landed text-textSoft labels at 4.40:1 in light mode, just under
        // WCAG AA's 4.5:1 (0.03 still only 4.45:1, 0.02 still 4.49:1); 0.01
        // measures 4.54:1 light / 7.37:1 dark - the active-stage highlight
        // is still visible via its own full-opacity border-teal/40, the
        // fill itself now barely more than a rounding error.
        active ? "border-teal/40 bg-teal/[0.01]" : "border-border/15 bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <ChevronRight
          size={14}
          className={`text-textSoft shrink-0 transition-transform duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            open ? "rotate-90" : ""
          }`}
        />
        <Icon size={15} className={active ? "text-teal" : "text-textSoft"} strokeWidth={1.75} />
        <span className={`text-[13px] font-medium ${active ? "text-teal" : "text-textSoft"}`}>
          {code} · {title}
        </span>
      </button>
      {/* grid-rows 0fr/1fr trick - animates to auto-height without measuring,
          pure CSS. Content stays mounted (not conditionally rendered) so its
          fields - all controlled by DealDrawer's own state, not local state -
          never lose a value while collapsed. */}
      <div
        className={`grid transition-[grid-template-rows] duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={`px-4 pb-4 pt-1 space-y-3 transition-opacity duration-200 ${
              open ? "opacity-100 delay-[40ms]" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

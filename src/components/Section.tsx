"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionProps {
  code: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  active?: boolean;
  children: ReactNode;
}

/** Collapsible per-stage block used in the client detail drawer, one per pipeline stage. */
export function Section({ code, title, icon: Icon, defaultOpen = false, active = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-md border ${active ? "border-brass/50" : "border-border"} bg-surface`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-textSoft shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-textSoft shrink-0" />
        )}
        <Icon size={15} className={active ? "text-brass" : "text-textSoft"} strokeWidth={1.75} />
        <span
          className={`font-heading text-xs uppercase tracking-wide ${
            active ? "text-brassSoft" : "text-textSoft"
          }`}
        >
          {code} · {title}
        </span>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

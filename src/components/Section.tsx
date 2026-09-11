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

/** Collapsible per-stage block used in the deal detail drawer, one per pipeline stage. */
export function Section({ code, title, icon: Icon, defaultOpen = false, active = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border ${active ? "border-teal/40" : "border-border/15"} bg-surface`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-textSoft shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-textSoft shrink-0" />
        )}
        <Icon size={15} className={active ? "text-teal" : "text-textSoft"} strokeWidth={1.75} />
        <span className={`text-[13px] font-medium ${active ? "text-teal" : "text-textSoft"}`}>
          {code} · {title}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

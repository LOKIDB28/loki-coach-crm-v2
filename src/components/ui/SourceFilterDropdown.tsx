"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { POPOVER_CHROME } from "@/lib/ui";
import type { SourceCount } from "@/lib/domain";

interface SourceFilterDropdownProps {
  sources: SourceCount[];
  /** null = "Toutes", "" = "Sans source", otherwise the exact source label. */
  active: string | null;
  onSelect: (v: string | null) => void;
}

/** Toolbar filter, near the search box - one source at a time, with a count per source, "Toutes" and "Sans source" pinned first. */
export function SourceFilterDropdown({ sources, active, onSelect }: SourceFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.isComposing) setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeLabel = active === null ? "Source" : active === "" ? "Sans source" : active;
  const isFilterActive = active !== null;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm min-h-11 sm:min-h-0 transition-colors duration-150 ${
          isFilterActive
            ? "border-teal/40 bg-teal/5 text-teal"
            : "border-border/20 text-textSoft hover:text-text hover:border-teal/40"
        }`}
      >
        <span className="truncate max-w-[10rem]">{activeLabel}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div role="listbox" className={`absolute left-0 top-full mt-1 z-30 w-64 max-h-80 overflow-y-auto py-1 ${POPOVER_CHROME}`}>
          <button
            type="button"
            role="option"
            aria-selected={active === null}
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface2 ${
              active === null ? "text-teal font-medium" : "text-text"
            }`}
          >
            Toutes
          </button>
          {sources.map((s) => (
            <button
              key={s.source ?? "__none__"}
              type="button"
              role="option"
              aria-selected={active === (s.source ?? "")}
              onClick={() => {
                onSelect(s.source ?? "");
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface2 ${
                active === (s.source ?? "") ? "text-teal font-medium" : "text-text"
              }`}
            >
              <span className="truncate">{s.label}</span>
              <span className="text-[11px] text-textSoft tabular-nums shrink-0">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

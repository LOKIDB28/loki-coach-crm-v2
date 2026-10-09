"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { POPOVER_CHROME } from "@/lib/ui";
import { TYPE_FILTERS, type TypeFilterKey } from "@/lib/domain";

interface TypeFilterDropdownProps {
  counts: Record<TypeFilterKey, number>;
  /** null = "Tous". */
  active: TypeFilterKey | null;
  onSelect: (v: TypeFilterKey | null) => void;
}

/**
 * Toolbar "Type" filter (deals.type_vehicule_vise), next to Source and in
 * the same style - same button, popover chrome and option rows as
 * SourceFilterDropdown, with a fixed list of groups instead of free-text
 * sources. "Tous" pinned first.
 */
export function TypeFilterDropdown({ counts, active, onSelect }: TypeFilterDropdownProps) {
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

  const activeLabel = active === null ? "Type" : TYPE_FILTERS.find((f) => f.key === active)?.label ?? "Type";
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
            Tous
          </button>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="option"
              aria-selected={active === f.key}
              onClick={() => {
                onSelect(f.key);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-surface2 ${
                active === f.key ? "text-teal font-medium" : "text-text"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{f.label}</span>
                {f.hint && <span className="block text-[11px] text-textSoft font-normal truncate">{f.hint}</span>}
              </span>
              <span className="text-[11px] text-textSoft tabular-nums shrink-0" data-testid={`type-count-${f.key}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

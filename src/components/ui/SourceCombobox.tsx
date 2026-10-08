"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TextInput } from "./TextInput";
import { POPOVER_CHROME } from "@/lib/ui";
import { SOURCE_SUGGESTIONS, findMatchingExistingSource, normalizeSourceKey } from "@/lib/domain";

interface SourceComboboxProps {
  value: string;
  onChange: (v: string) => void;
  /** Up to 6 recent, non-fixed sources - see getRecentSources (lib/domain.ts). */
  recentSources: string[];
  /** Every distinct source value in use, for the "propose the existing spelling" check. */
  allKnownSources: string[];
}

type ItemKind = "proposal" | "recent" | "fixed";
interface FlatItem {
  kind: ItemKind;
  label: string;
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Free-text input + a custom two-group suggestion list ("Sources récentes"
 * then "Canaux" - SOURCE_SUGGESTIONS) - replaces the native <datalist> this
 * field used before (NewDealModal, DealDrawer Section 1). A real ARIA
 * combobox, not a styled-up datalist: role="combobox" on the input,
 * role="listbox"/"option" on the panel, aria-expanded/aria-controls/
 * aria-activedescendant kept in sync with the open/highlighted state,
 * ArrowUp/ArrowDown move the highlight, Enter chooses it, Tab closes the
 * list without forcing a choice (focus still moves on normally).
 *
 * Escape closes the list ONLY and calls stopPropagation so the enclosing
 * modal/drawer's own Escape-to-close handler never sees it - same
 * "innermost active layer owns Escape" principle as that handler's existing
 * isAutocompleteOrDateField skip (for the native popups this replaces) and
 * the lot-2 pendingClose-banner-first pattern. When the list is already
 * closed, Escape is left alone to bubble up normally. isComposing (IME
 * dead-key sequences, e.g. ^ then e for ê) is ignored for the same reason
 * as every other Escape handler in this app.
 *
 * Opens upward instead of downward when there isn't enough room below
 * before the nearest scrolling ancestor's own visible edge (the modal/
 * drawer's own overflow-y-auto body, auto-detected - never the logo of the
 * header "next sticky footer" is reached without first passing a scroll
 * container, which is where NewDealModal's and DealDrawer's own sticky
 * footers live) - so the list never slides under a sticky footer.
 */
export function SourceCombobox({ value, onChange, recentSources, allKnownSources }: SourceComboboxProps) {
  const instanceId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState(288); // 18rem, same as the old datalist-era cap

  const q = normalizeSourceKey(value);
  const filteredRecent = useMemo(
    () => (q ? recentSources.filter((s) => normalizeSourceKey(s).includes(q)) : recentSources),
    [recentSources, q]
  );
  const filteredFixed = useMemo(
    () => (q ? SOURCE_SUGGESTIONS.filter((s) => normalizeSourceKey(s).includes(q)) : SOURCE_SUGGESTIONS),
    [q]
  );
  const proposal = useMemo(() => findMatchingExistingSource(value, allKnownSources), [value, allKnownSources]);

  const items: FlatItem[] = useMemo(() => {
    const list: FlatItem[] = [];
    if (proposal) list.push({ kind: "proposal", label: proposal });
    for (const s of filteredRecent) list.push({ kind: "recent", label: s });
    for (const s of filteredFixed) list.push({ kind: "fixed", label: s });
    return list;
  }, [proposal, filteredRecent, filteredFixed]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(items.length - 1);
  }, [items.length, activeIndex]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function openList() {
    const input = inputRef.current;
    const scrollParent = getScrollParent(input);
    if (input) {
      const inputRect = input.getBoundingClientRect();
      const boundsRect = scrollParent ? scrollParent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const spaceBelow = boundsRect.bottom - inputRect.bottom;
      const spaceAbove = inputRect.top - boundsRect.top;
      const desired = 288;
      if (spaceBelow < Math.min(desired, 160) && spaceAbove > spaceBelow) {
        setOpenUpward(true);
        setPanelMaxHeight(Math.max(120, Math.min(desired, spaceAbove - 8)));
      } else {
        setOpenUpward(false);
        setPanelMaxHeight(Math.max(120, Math.min(desired, spaceBelow - 8)));
      }
    }
    setOpen(true);
  }

  function choose(label: string) {
    onChange(label);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        choose(items[activeIndex].label);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const listboxId = `${instanceId}-listbox`;
  const activeOptionId = activeIndex >= 0 ? `${instanceId}-option-${activeIndex}` : undefined;

  let recentHeaderShown = false;
  let fixedHeaderShown = false;

  return (
    <div className="relative" ref={wrapperRef}>
      <TextInput
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(-1);
          if (!open) openList();
          else setOpen(true);
        }}
        onFocus={() => {
          if (!open) openList();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Facebook, Salon nautique, ..."
        autoComplete="off"
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          style={{
            [openUpward ? "bottom" : "top"]: "100%",
            [openUpward ? "marginBottom" : "marginTop"]: 4,
            maxHeight: panelMaxHeight,
          }}
          className={`absolute left-0 right-0 z-30 overflow-y-auto py-1 ${POPOVER_CHROME}`}
        >
          {items.length === 0 && (
            <div className="px-3 py-2 text-xs text-textSoft">
              Aucune suggestion - « {value} » sera une nouvelle source.
            </div>
          )}
          {items.map((it, i) => {
            const showRecentHeader = it.kind === "recent" && !recentHeaderShown && (recentHeaderShown = true);
            const showFixedHeader = it.kind === "fixed" && !fixedHeaderShown && (fixedHeaderShown = true);
            const id = `${instanceId}-option-${i}`;
            const isActive = i === activeIndex;
            return (
              <div key={`${it.kind}-${it.label}`}>
                {showRecentHeader && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-textSoft/70">
                    Sources récentes
                  </div>
                )}
                {showFixedHeader && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-textSoft/70">
                    Canaux
                  </div>
                )}
                <div
                  id={id}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(it.label);
                  }}
                  className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-surface2 ${
                    it.kind === "proposal"
                      ? "text-teal text-xs py-2 border-b border-border/15"
                      : isActive
                        ? "bg-surface2 text-text"
                        : "text-text"
                  }`}
                >
                  {it.kind === "proposal" ? (
                    <>
                      Vouliez-vous dire « <span className="font-semibold">{it.label}</span> » ?
                    </>
                  ) : (
                    it.label
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

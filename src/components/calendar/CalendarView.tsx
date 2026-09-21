"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addWeeks,
  buildCalendarEvents,
  formatWeekLabel,
  getWeekDays,
  REP_FILTERS,
} from "@/lib/calendar";
import { assignCategoricalColors } from "@/lib/domain";
import { COLORS } from "@/lib/theme";
import type { DealWithContact, Profile } from "@/lib/types";
import { WeekGrid } from "./WeekGrid";
import { DayList } from "./DayList";

interface CalendarViewProps {
  deals: DealWithContact[];
  profiles: Profile[];
  onOpen: (dealId: string) => void;
}

const UNASSIGNED_LABEL = "Non assigné";

/**
 * Weekly calendar replacing the old "Suivis à faire" list. Purely a
 * reorganization of deals already loaded by the parent - no separate
 * fetch. Desktop gets a 7-column grid (WeekGrid), mobile a stacked
 * day-by-day list (DayList) via CSS breakpoints, same responsive
 * convention as the rest of the app (no JS viewport detection).
 */
export function CalendarView({ deals, profiles, onOpen }: CalendarViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [activeEmail, setActiveEmail] = useState<string | null>(null); // null = "Tout"

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const allEvents = useMemo(() => buildCalendarEvents(deals), [deals]);

  const ownerNameById = useMemo(() => new Map(profiles.map((p) => [p.id, p.nom || p.email])), [profiles]);

  const activeOwnerId = useMemo(() => {
    if (!activeEmail) return null;
    return profiles.find((p) => p.email === activeEmail)?.id ?? null;
  }, [activeEmail, profiles]);

  const events = useMemo(
    () => (activeOwnerId ? allEvents.filter((e) => e.ownerId === activeOwnerId) : allEvents),
    [allEvents, activeOwnerId]
  );

  // Stable per-rep color across both the grid and the mobile list, built
  // from the same brand-constrained palette already used for LOKI
  // Intelligence's categorical charts - not a new color system.
  const repColors = useMemo(() => {
    const names = Array.from(
      new Set(allEvents.map((e) => (e.ownerId ? ownerNameById.get(e.ownerId) ?? UNASSIGNED_LABEL : UNASSIGNED_LABEL)))
    );
    return assignCategoricalColors(names);
  }, [allEvents, ownerNameById]);

  function repColorFor(ownerId: string | null): string {
    const name = ownerId ? ownerNameById.get(ownerId) ?? UNASSIGNED_LABEL : UNASSIGNED_LABEL;
    return repColors.get(name) ?? COLORS.stone;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((d) => addWeeks(d, -1))}
            aria-label="Semaine précédente"
            className="flex items-center justify-center min-w-9 min-h-9 rounded-lg text-textSoft hover:text-teal hover:bg-surface2"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text px-1 min-w-[150px] text-center">
            {formatWeekLabel(weekDays)}
          </span>
          <button
            type="button"
            onClick={() => setAnchor((d) => addWeeks(d, 1))}
            aria-label="Semaine suivante"
            className="flex items-center justify-center min-w-9 min-h-9 rounded-lg text-textSoft hover:text-teal hover:bg-surface2"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="text-xs font-medium text-teal hover:underline ml-1"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterPill active={activeEmail === null} label="Tout" onClick={() => setActiveEmail(null)} />
          {REP_FILTERS.map((r) => (
            <FilterPill key={r.email} active={activeEmail === r.email} label={r.label} onClick={() => setActiveEmail(r.email)} />
          ))}
        </div>
      </div>

      <div className="hidden sm:block">
        <WeekGrid days={weekDays} events={events} repColorFor={repColorFor} onOpen={onOpen} />
      </div>
      <div className="sm:hidden">
        <DayList days={weekDays} events={events} repColorFor={repColorFor} onOpen={onOpen} />
      </div>
    </div>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
        active ? "border-teal bg-teal/10 text-teal" : "border-border/20 text-textSoft hover:border-teal/40"
      }`}
    >
      {label}
    </button>
  );
}

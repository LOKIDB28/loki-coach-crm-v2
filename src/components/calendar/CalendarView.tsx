"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  addWeeks,
  buildCalendarEvents,
  formatMonthLabel,
  formatWeekLabel,
  getMonthDays,
  getWeekDays,
  REP_FILTERS,
} from "@/lib/calendar";
import { assignCategoricalColors } from "@/lib/domain";
import { COLORS } from "@/lib/theme";
import type { DealWithContact, Profile } from "@/lib/types";
import { WeekGrid } from "./WeekGrid";
import { DayList } from "./DayList";
import { MonthGrid } from "./MonthGrid";

interface CalendarViewProps {
  deals: DealWithContact[];
  profiles: Profile[];
  onOpen: (dealId: string) => void;
}

const UNASSIGNED_LABEL = "Non assigné";
type Granularity = "semaine" | "mois";

/**
 * Weekly calendar (default) or monthly grid, replacing the old "Suivis à
 * faire" list. Purely a reorganization of deals already loaded by the
 * parent - no separate fetch. The week path (WeekGrid/DayList) and the
 * .ics feed are untouched by the month view added alongside it - same
 * `anchor` date drives both, interpreted as a week or a month depending
 * on `granularity`, so switching views keeps the same neighborhood in
 * time instead of resetting.
 */
export function CalendarView({ deals, profiles, onOpen }: CalendarViewProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [granularity, setGranularity] = useState<Granularity>("semaine");
  const [activeEmail, setActiveEmail] = useState<string | null>(null); // null = "Tout"

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const monthDays = useMemo(() => getMonthDays(anchor), [anchor]);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setAnchor((d) => (granularity === "semaine" ? addWeeks(d, -1) : addMonths(d, -1)))}
            aria-label={granularity === "semaine" ? "Semaine précédente" : "Mois précédent"}
            className="flex items-center justify-center min-w-9 min-h-9 rounded-[9px] text-textSoft hover:text-teal hover:bg-surface2 transition-colors duration-150"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text px-1.5 min-w-[150px] text-center">
            {granularity === "semaine" ? formatWeekLabel(weekDays) : formatMonthLabel(anchor)}
          </span>
          <button
            type="button"
            onClick={() => setAnchor((d) => (granularity === "semaine" ? addWeeks(d, 1) : addMonths(d, 1)))}
            aria-label={granularity === "semaine" ? "Semaine suivante" : "Mois suivant"}
            className="flex items-center justify-center min-w-9 min-h-9 rounded-[9px] text-textSoft hover:text-teal hover:bg-surface2 transition-colors duration-150"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="text-xs font-semibold text-teal px-2 py-1 rounded-lg hover:bg-teal/10 transition-colors duration-150 ml-0.5"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-border/20 p-0.5 mr-1">
            <GranularityPill active={granularity === "semaine"} label="Semaine" onClick={() => setGranularity("semaine")} />
            <GranularityPill active={granularity === "mois"} label="Mois" onClick={() => setGranularity("mois")} />
          </div>
          <FilterPill active={activeEmail === null} label="Tout" onClick={() => setActiveEmail(null)} />
          {REP_FILTERS.map((r) => (
            <FilterPill key={r.email} active={activeEmail === r.email} label={r.label} onClick={() => setActiveEmail(r.email)} />
          ))}
        </div>
      </div>

      {granularity === "semaine" ? (
        <>
          <div className="hidden sm:block">
            <WeekGrid days={weekDays} events={events} repColorFor={repColorFor} onOpen={onOpen} />
          </div>
          <div className="sm:hidden">
            <DayList days={weekDays} events={events} repColorFor={repColorFor} onOpen={onOpen} />
          </div>
        </>
      ) : (
        <MonthGrid monthAnchor={anchor} days={monthDays} events={events} repColorFor={repColorFor} onOpen={onOpen} />
      )}
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

function GranularityPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors duration-150 ${
        active ? "bg-teal/10 text-teal" : "text-textSoft hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

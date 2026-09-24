"use client";

import { Car, Factory, Building2, CalendarClock, Wrench } from "lucide-react";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar";

const TYPE_ICONS: Record<CalendarEventType, typeof CalendarClock> = {
  next_action_at: CalendarClock,
  date_essai_routier: Car,
  date_visite_usine: Factory,
  date_visite_bureau: Building2,
  date_rdv_service: Wrench,
};

interface EventChipProps {
  event: CalendarEvent;
  /** Rep color from assignCategoricalColors (lib/domain.ts) - format varies
      (plain hex, hex+alpha, or rgb()) so it's only ever used as a standalone
      color value here, never concatenated with another alpha suffix. */
  color: string;
  onOpen: (dealId: string) => void;
}

/** One event, shared between WeekGrid and DayList so both render identically. Neutral background, colored left border + icon carries the rep color - avoids needing to blend an unpredictable color-string format into a background tint. */
export function EventChip({ event, color, onOpen }: EventChipProps) {
  const Icon = TYPE_ICONS[event.type];
  const time = event.allDay
    ? null
    : event.date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={() => onOpen(event.dealId)}
      className="w-full flex items-center gap-1.5 rounded-lg bg-surface2 border-l-2 px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface2/70"
      style={{ borderLeftColor: color }}
      title={`${event.label} — ${event.clientName}`}
    >
      <Icon size={11} className="shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1 truncate text-[11px] text-text">
        {time && <span className="font-medium">{time} </span>}
        {event.clientName}
      </span>
    </button>
  );
}

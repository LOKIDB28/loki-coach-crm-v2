"use client";

import { isSameDay, type CalendarEvent } from "@/lib/calendar";
import { EventChip } from "./EventChip";

const DAY_LABELS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface DayListProps {
  days: Date[];
  events: CalendarEvent[];
  repColorFor: (ownerId: string | null) => string;
  onOpen: (dealId: string) => void;
}

/** Mobile adaptation - the full week, but as 7 stacked day sections (not a 7-column grid, too cramped on a phone) so the "weekly" framing survives; each section only rendered if it has events, to keep the scroll short on an ordinarily-quiet week. */
export function DayList({ days, events, repColorFor, onOpen }: DayListProps) {
  const today = new Date();
  const daysWithEvents = days
    .map((day, i) => ({
      day,
      label: DAY_LABELS_LONG[i]!,
      isToday: isSameDay(day, today),
      dayEvents: events
        .filter((e) => isSameDay(e.date, day))
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          return a.date.getTime() - b.date.getTime();
        }),
    }))
    .filter((d) => d.dayEvents.length > 0);

  if (daysWithEvents.length === 0) {
    return <p className="text-sm text-textSoft py-8 text-center">Aucun événement cette semaine.</p>;
  }

  return (
    <div className="space-y-3">
      {daysWithEvents.map(({ day, label, isToday, dayEvents }) => (
        <div key={day.toISOString()}>
          <div className={`flex items-baseline gap-1.5 mb-1.5 ${isToday ? "text-teal" : "text-textSoft"}`}>
            <span className={`text-xs font-medium ${isToday ? "font-semibold" : ""}`}>{label}</span>
            <span className="text-[11px]">{day.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</span>
          </div>
          <div className="space-y-1">
            {dayEvents.map((e) => (
              <EventChip key={e.id} event={e} color={repColorFor(e.ownerId)} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

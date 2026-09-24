"use client";

import { isSameDay, type CalendarEvent } from "@/lib/calendar";
import { EventChip } from "./EventChip";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface WeekGridProps {
  days: Date[];
  events: CalendarEvent[];
  repColorFor: (ownerId: string | null) => string;
  onOpen: (dealId: string) => void;
}

/** Desktop 7-column week grid - all-day events (date_rdv_service) sort above timed ones, then chronologically within each. */
export function WeekGrid({ days, events, repColorFor, onOpen }: WeekGridProps) {
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dayEvents = events
          .filter((e) => isSameDay(e.date, day))
          .sort((a, b) => {
            if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
            return a.date.getTime() - b.date.getTime();
          });
        const isToday = isSameDay(day, today);

        return (
          <div
            key={day.toISOString()}
            className={`min-h-[160px] rounded-[14px] border p-1.5 ${
              isToday ? "border-teal/35 bg-teal/[0.04]" : "border-border/15 bg-surface"
            }`}
          >
            <div className="text-center mb-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-textSoft">{DAY_LABELS[i]}</div>
              {isToday ? (
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal text-white text-sm font-semibold mt-0.5">
                  {day.getDate()}
                </div>
              ) : (
                <div className="text-sm text-text mt-0.5">{day.getDate()}</div>
              )}
            </div>
            <div className="space-y-1">
              {dayEvents.length === 0 ? (
                <p className="text-[10px] text-textSoft/60 text-center pt-2">—</p>
              ) : (
                dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} color={repColorFor(e.ownerId)} onOpen={onOpen} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

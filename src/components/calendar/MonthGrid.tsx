"use client";

import { isSameDay, type CalendarEvent } from "@/lib/calendar";
import { EventChip } from "./EventChip";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_VISIBLE_PER_DAY = 3;

interface MonthGridProps {
  /** Any date within the month being displayed - used only to know which cells belong to leading/trailing adjacent months. */
  monthAnchor: Date;
  /** The fixed 42-day grid from getMonthDays(). */
  days: Date[];
  events: CalendarEvent[];
  repColorFor: (ownerId: string | null) => string;
  onOpen: (dealId: string) => void;
}

/** Standard 6x7 month grid. Each cell caps visible events at 3 (a month cell has far less room than a week column) with a "+N" count for the rest - every visible chip is still clickable, same EventChip as the week view. */
export function MonthGrid({ monthAnchor, days, events, repColorFor, onOpen }: MonthGridProps) {
  const today = new Date();
  const currentMonth = monthAnchor.getMonth();

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium uppercase tracking-wide text-textSoft py-1">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = events
            .filter((e) => isSameDay(e.date, day))
            .sort((a, b) => {
              if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
              return a.date.getTime() - b.date.getTime();
            });
          const isToday = isSameDay(day, today);
          const inMonth = day.getMonth() === currentMonth;
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[84px] rounded-lg border border-border/15 p-1 ${inMonth ? "bg-surface" : "bg-surface2/40"}`}
            >
              <div
                className={`text-[11px] text-right pr-0.5 ${
                  isToday ? "text-teal font-semibold" : inMonth ? "text-textSoft" : "text-textSoft/40"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5 mt-0.5">
                {visible.map((e) => (
                  <EventChip key={e.id} event={e} color={repColorFor(e.ownerId)} onOpen={onOpen} />
                ))}
                {overflow > 0 && <p className="text-[10px] text-textSoft px-1">+{overflow}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

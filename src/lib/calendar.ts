// Pure data/date helpers for the weekly calendar - no Supabase/React
// dependency, deals already loaded by page.tsx are flattened into events
// here, no separate fetch.
import { fullName } from "./domain";
import type { DealWithContact } from "./types";

export type CalendarEventType =
  | "next_action_at"
  | "date_essai_routier"
  | "date_visite_usine"
  | "date_visite_bureau"
  | "date_rdv_service";

interface EventTypeConfig {
  key: CalendarEventType;
  label: string;
  /** true for the one plain `date` column (date_rdv_service) - no time-of-day, parsed as a local calendar date rather than a UTC instant. */
  allDay: boolean;
}

// Scope confirmed in conversation: these 5 only. date_contrat (historical,
// not an upcoming appointment) and expected_close (a forecast, not a
// dated appointment) are deliberately excluded, as is premier_contact_le
// (retrospective, already surfaced via the DealCard "Contacté" badge).
// date_visite_bureau (0018_add_deals_date_visite_bureau.sql) kept as its
// own entry rather than merged with date_visite_usine - the two are a
// different rendez-vous type in real life (different on-site security
// rules at the factory), not a wording variant of the same thing, so this
// calendar and the .ics feed (src/app/api/calendar/[token]/route.ts) both
// need to know about it as a distinct type.
export const EVENT_TYPES: EventTypeConfig[] = [
  { key: "next_action_at", label: "Relance", allDay: false },
  { key: "date_essai_routier", label: "Essai routier", allDay: false },
  { key: "date_visite_usine", label: "Visite d'usine", allDay: false },
  { key: "date_visite_bureau", label: "Visite au bureau", allDay: false },
  { key: "date_rdv_service", label: "Rendez-vous service", allDay: true },
];

export interface CalendarEvent {
  id: string;
  dealId: string;
  type: CalendarEventType;
  label: string;
  allDay: boolean;
  date: Date;
  clientName: string;
  ownerId: string | null;
}

/** "2026-09-21" parsed as a LOCAL calendar date, not UTC midnight - new Date(isoDateOnly) would shift a day back in any negative UTC offset (e.g. Quebec), a classic date-only parsing bug. */
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function buildCalendarEvents(deals: DealWithContact[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const deal of deals) {
    const clientName = fullName(deal.contact) || "(sans nom)";
    for (const type of EVENT_TYPES) {
      const raw = deal[type.key] as string | null;
      if (!raw) continue;
      events.push({
        id: `${deal.id}-${type.key}`,
        dealId: deal.id,
        type: type.key,
        label: type.label,
        allDay: type.allDay,
        date: type.allDay ? parseDateOnly(raw) : new Date(raw),
        clientName,
        ownerId: deal.owner_id,
      });
    }
  }
  return events;
}

// Fixed set confirmed in conversation, matched by exact email - same
// discipline as the owner_id migration (no guessed name matching).
export const REP_FILTERS = [
  { label: "Fred", email: "frederick.sabourin@lokicoach.com" },
  { label: "Jeff", email: "jeff@lokicoach.com" },
  { label: "PM", email: "pm@lokicoach.com" },
] as const;

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  d.setDate(d.getDate() + diff);
  return d;
}

/** The 7 days (Monday-Sunday) of the week containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function formatWeekLabel(days: Date[]): string {
  const start = days[0]!;
  const end = days[6]!;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString("fr-CA", { day: "numeric", month: sameMonth ? undefined : "short" });
  const endStr = end.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

// --- Month view - purely additive, none of the above (week view or the
// .ics feed, which doesn't import this file at all) is touched by any of
// what follows. ---

/** Fixed 6-row (42-day) Monday-start grid containing the month of `anchor` - includes the trailing days of the previous/next month needed to fill the grid, same convention as every standard month calendar. */
export function getMonthDays(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function formatMonthLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

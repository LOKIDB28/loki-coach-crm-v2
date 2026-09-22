// Minimal RFC 5545 (iCalendar) generator for the per-rep .ics feed. No
// dependency - the feed is a handful of one-off VEVENTs, not worth pulling
// in a library for. Kept free of any Supabase/Next import so it's testable
// as plain data-in, string-out.

export interface IcsEvent {
  /** Stable across regenerations - used as the VEVENT UID, not shown to the user. */
  id: string;
  title: string;
  description: string;
  /** ISO 8601 timestamp for a timed event, or a bare "YYYY-MM-DD" date when allDay is true. */
  start: string;
  /** True for a date-only event (currently only date_rdv_service) - emitted as an RFC 5545 all-day VEVENT (DTSTART/DTEND;VALUE=DATE, no time or "Z"), never routed through a Date/timezone conversion. */
  allDay?: boolean;
}

const CRLF = "\r\n";

/** Escapes backslash, semicolon, comma, and newlines per RFC 5545 §3.3.11 - must run before folding. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/**
 * Folds a content line at 75 octets with a CRLF + single leading space on
 * the continuation, per RFC 5545 §3.1. Approximates "octets" as UTF-16
 * code units - not byte-exact for multi-byte UTF-8 (accented names, etc.),
 * but produces valid, if occasionally slightly-early, folds - real ICS
 * parsers tolerate a short line, they don't tolerate an over-long one.
 */
function foldLine(line: string): string {
  const LIMIT = 75;
  if (line.length <= LIMIT) return line;
  const parts: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const take = first ? LIMIT : LIMIT - 1; // continuation lines lose 1 char to the leading space
    parts.push((first ? "" : " ") + rest.slice(0, take));
    rest = rest.slice(take);
    first = false;
  }
  return parts.join(CRLF);
}

/** "2026-09-18T14:30:00.000Z" -> "20260918T143000Z" (always UTC, per DTSTART...Z). */
function formatIcsDateUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

const EVENT_DURATION_MINUTES = 30;

/** "2026-09-21" -> "20260921", for DTSTART/DTEND;VALUE=DATE. */
function formatIcsDateOnly(dateOnly: string): string {
  return dateOnly.replace(/-/g, "");
}

/**
 * The day after a "YYYY-MM-DD" date, still as "YYYY-MM-DD" - DTEND on an
 * all-day VEVENT is exclusive per RFC 5545, so a 1-day event's end is the
 * following day. Computed from UTC components only (Date.UTC to build,
 * getUTC* to read back) - deliberately never routed through a
 * timezone-sensitive Date parse, same discipline as parseDateOnly in
 * lib/calendar.ts.
 */
function nextDateOnly(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function buildEvent(event: IcsEvent): string {
  const now = formatIcsDateUtc(new Date().toISOString());

  const lines = ["BEGIN:VEVENT", `UID:${event.id}@loki-coach-crm`, `DTSTAMP:${now}`];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDateOnly(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDateOnly(nextDateOnly(event.start))}`);
  } else {
    const start = new Date(event.start);
    const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);
    lines.push(`DTSTART:${formatIcsDateUtc(event.start)}`);
    lines.push(`DTEND:${formatIcsDateUtc(end.toISOString())}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description)}`, "END:VEVENT");
  return lines.map(foldLine).join(CRLF);
}

/** Builds a full VCALENDAR document - one VEVENT per event, no recurrence. */
export function buildIcsCalendar(calendarName: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LOKI Coach CRM//Calendar Feed//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    ...events.map(buildEvent),
    "END:VCALENDAR",
  ];
  return lines.join(CRLF) + CRLF;
}

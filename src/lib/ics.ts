// Minimal RFC 5545 (iCalendar) generator for the per-rep .ics feed. No
// dependency - the feed is a handful of one-off VEVENTs, not worth pulling
// in a library for. Kept free of any Supabase/Next import so it's testable
// as plain data-in, string-out.

export interface IcsEvent {
  /** Stable across regenerations - used as the VEVENT UID, not shown to the user. */
  id: string;
  title: string;
  description: string;
  /** ISO 8601 timestamp - the relance's next_action_at. */
  start: string;
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

function buildEvent(event: IcsEvent): string {
  const start = new Date(event.start);
  const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);
  const now = formatIcsDateUtc(new Date().toISOString());

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@loki-coach-crm`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDateUtc(event.start)}`,
    `DTEND:${formatIcsDateUtc(end.toISOString())}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "END:VEVENT",
  ];
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

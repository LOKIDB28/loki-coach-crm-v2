import { test, expect } from "@playwright/test";
import type { ErrorEvent } from "@sentry/nextjs";
import { buildIcsCalendar } from "../src/lib/ics";
import { scrubCalendarToken } from "../src/lib/sentry-scrub";

// Pure data-in, string-out checks on the .ics generator and the Sentry
// scrubber - no page, no Supabase, fictitious data only (ID below is not a
// real deal, and FAKE_TOKEN is not a real calendar token).
const ID = "00000000-0000-4000-8000-000000000001";
const FAKE_TOKEN = "00000000-0000-4000-8000-0000000000aa";
const ev = (title: string, extra = {}) => ({
  id: `${ID}-relance`,
  title,
  description: "Fiche du deal : https://crm.exemple.test/?deal=" + ID,
  start: "2026-10-21T14:30:00.000Z",
  ...extra,
});

test("aucune ligne ne dépasse 75 octets UTF-8 et rien n'est corrompu", () => {
  const ics = buildIcsCalendar("LOKI CRM — Suivis de Gérald Côté", [
    ev("Rendez-vous service — Marie-Ève Bélanger-Thériault (Hélène Dénommée)"),
    ev("Visite — Jean-François " + "🚌".repeat(30)),
  ]);
  for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  expect(Buffer.from(ics, "utf8").toString("utf8")).not.toContain("\uFFFD");
  const unfolded = ics.replace(/\r\n /g, "");
  expect(unfolded).toContain("SUMMARY:Rendez-vous service — Marie-Ève Bélanger-Thériault (Hélène Dénommée)");
  expect(unfolded).toContain("SUMMARY:Visite — Jean-François " + "🚌".repeat(30));
});

test("UID stable entre deux générations, all-day exclusif", () => {
  const a = buildIcsCalendar("c", [ev("x"), { ...ev("y"), id: `${ID}-rdv_service`, start: "2026-12-31", allDay: true }]);
  const b = buildIcsCalendar("c", [ev("x"), { ...ev("y"), id: `${ID}-rdv_service`, start: "2026-12-31", allDay: true }]);
  const uids = (s: string) => s.match(/^UID:.*$/gm);
  expect(uids(a)).toEqual(uids(b));
  expect(a).toContain("DTSTART;VALUE=DATE:20261231");
  expect(a).toContain("DTEND;VALUE=DATE:20270101");
});

test("Sentry : le jeton du flux est masqué, y compris dans contexts.nextjs.request_path", () => {
  const path = `/api/calendar/${FAKE_TOKEN}.ics`;
  const event = {
    request: { url: `https://crm.exemple.test${path}` },
    contexts: { nextjs: { request_path: path, router_kind: "App Router" } },
  } as unknown as ErrorEvent;
  const scrubbed = JSON.stringify(scrubCalendarToken(event));
  expect(scrubbed).not.toContain(FAKE_TOKEN);
  expect(scrubbed).toContain("/api/calendar/[REDACTED]");
});

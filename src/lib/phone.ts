// Phone formatting for display and input - pure, no dependency. Lossless by
// design: the result always keeps every digit, the extension and any
// country code of the input. Anything that doesn't fit a known format comes
// back exactly as typed (trimmed), never "cleaned up". Existing rows in
// contacts.telephone are never rewritten by this module - callers format at
// display time, and only format at input time when the user actually typed.

import { neutralizeCsvFormula } from "./csv";

/** Extension at the end: "x123", "x 123", "ext 123", "ext. 123", "poste 123", "#123". */
const EXTENSION = /\s*(?:x|ext\.?|poste|#)\s*(\d+)\s*$/i;

/** Main number may only contain digits and common separators, "+" only first. */
const NUMBER_CHARS = /^\+?[\d\s().\-/]+$/;

/**
 * "(418) 805-5602", "418.805.5602", "1-418-805-5602", "+1 418 805 5602",
 * "4188055602" → "+1-418-805-5602". An extension is kept as " x123".
 * 10 digits without a country code are treated as +1 (North America).
 * Other country codes ("+52 …") and every unrecognized shape are returned
 * exactly as typed (trimmed) - no North American split forced on them.
 */
export function formatPhone(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  const ext = raw.match(EXTENSION);
  const main = ext ? raw.slice(0, ext.index).trim() : raw;
  if (!main || !NUMBER_CHARS.test(main)) return raw;

  const digits = main.replace(/\D/g, "");
  const hasPlus = main.startsWith("+");

  let national: string | null = null;
  if (!hasPlus && digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  if (!national) return raw;

  const formatted = `+1-${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  return ext ? `${formatted} x${ext[1]}` : formatted;
}

/** Digits only - for matching a typed search ("418 805", "4188055602") against any stored format. */
export function phoneDigits(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Duplicate-detection key: main number as digits with a leading North
 * American "1" dropped (11 digits starting with 1), and the extension kept
 * apart - "(418) 805-5602 poste 123" and "+1-418-805-5602 x123" share the
 * key "4188055602x123", while "x123" and "x456" on the same switchboard
 * stay two different people. Empty string when there's no digit at all.
 */
export function phoneKey(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  const ext = raw.match(EXTENSION);
  const main = phoneDigits(ext ? raw.slice(0, ext.index) : raw);
  const national = main.length === 11 && main.startsWith("1") ? main.slice(1) : main;
  if (!national) return "";
  return ext ? `${national}x${ext[1]}` : national;
}

/** A search that looks like (part of) a phone number: phone characters only, at least 3 digits. */
const PHONE_QUERY = /^\+?[\d\s().\-/]+$/;

/**
 * True when a phone-like search ("418 805", "4188055602", "+1-418-805")
 * matches a stored number by digits, whatever its stored format - compared
 * against the stored text's digits and against its +1-formatted digits, so
 * a "+1-…" query also finds an unformatted "(418) 805-5602". Never true for
 * a non-phone-like query: callers keep their plain text match alongside,
 * so this can only add results, never remove one.
 */
export function phoneMatchesQuery(phone: string | null | undefined, query: string): boolean {
  const q = query.trim();
  if (!phone || !PHONE_QUERY.test(q)) return false;
  const qDigits = phoneDigits(q);
  if (qDigits.length < 3) return false;
  return phoneDigits(phone).includes(qDigits) || phoneDigits(formatPhone(phone)).includes(qDigits);
}

/** A North American number exactly as formatPhone writes it, extension optional. */
const FORMATTED_NANP = /^\+1-\d{3}-\d{3}-\d{4}( x\d+)?$/;

/** "+CC rest": a 1-3 digit country code followed by a space. */
const COUNTRY_CODE_THEN_SPACE = /^\+(\d{1,3}) (.+)$/;

/**
 * Phone cell for the CSV export, never read as a formula by a spreadsheet.
 * A cell starting with = + - @ (or a tab / carriage return) can be
 * evaluated as one - in Excel, an unprotected "+1-418-805-5602" displays
 * as -6824. Both shapes below were checked by LP in Excel: they display as
 * plain text, with nothing added in front.
 *   1. +1 numbers drop the "+": "1-418-805-5602" (extension kept).
 *   2. Other "+CC rest" numbers put the code in parentheses:
 *      "(+52) 55 1234 5678".
 *   3. Last resort only - anything that still starts with one of those
 *      characters (e.g. the ambiguous "+4188055602") gets a leading
 *      apostrophe, which Excel does display, but which keeps every
 *      character.
 */
export function phoneForCsv(input: string | null | undefined): string {
  const formatted = formatPhone(input);
  let cell = formatted;
  if (FORMATTED_NANP.test(formatted)) {
    cell = formatted.slice(1);
  } else {
    const cc = formatted.match(COUNTRY_CODE_THEN_SPACE);
    if (cc) cell = `(+${cc[1]}) ${cc[2]}`;
  }
  return neutralizeCsvFormula(cell);
}

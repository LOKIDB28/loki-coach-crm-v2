// Phone formatting for display and input - pure, no dependency. Lossless by
// design: the result always keeps every digit, the extension and any
// country code of the input. Anything that doesn't fit a known format comes
// back exactly as typed (trimmed), never "cleaned up". Existing rows in
// contacts.telephone are never rewritten by this module - callers format at
// display time, and only format at input time when the user actually typed.

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

/**
 * Phone cell for the CSV export: formatted, then neutralized against
 * spreadsheet formula injection. A cell starting with = + - @ (or a tab /
 * carriage return) can be evaluated as a formula by spreadsheet apps (Excel
 * notably) - "+1-418-805-5602" could open as -6824. Prefixed with a single
 * apostrophe (OWASP's CSV-injection remediation): every character of the
 * number is kept, the "+" country code included.
 */
export function phoneForCsv(input: string | null | undefined): string {
  const formatted = formatPhone(input);
  return /^[=+\-@\t\r]/.test(formatted) ? `'${formatted}` : formatted;
}

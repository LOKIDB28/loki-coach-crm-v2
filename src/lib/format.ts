// Small formatting helpers shared across components. fr-CA locale
// throughout, matching the prototype's Québécois audience.

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/**
 * `value` is always stored/passed in as CAD (deals.montant has no currency
 * column - see 0010_import_pipedrive_deals.sql, USD Pipedrive deals were
 * converted to CAD once at import time). `usdToCad` is the live, editable
 * rate from public.exchange_rates (lib/data.ts fetchExchangeRate) - this
 * function stays pure/Supabase-free per the file header, so it never
 * fetches that itself, only converts with whatever the caller already has
 * loaded. Every existing call site keeps working unchanged (both extra
 * params are optional, default CAD).
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: "CAD" | "USD" = "CAD",
  usdToCad?: number
): string {
  if (value === null || value === undefined) return "—";
  const amount = currency === "USD" && usdToCad ? value / usdToCad : value;
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Converts a Date/ISO string to the value a <input type="datetime-local"> expects, in local time. */
export function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Converts a <input type="datetime-local"> value back to an ISO string for storage, or null if empty. */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** Whole days since an overdue next_action_at - only meaningful when isOverdue(value) is true. */
export function daysOverdue(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

/**
 * Whole days since any past timestamp - same math as daysOverdue, but that
 * one is named/documented for follow-up lateness specifically. Kept
 * separate so a call site about lead age (e.g. DealCard's uncontacted-lead
 * badge, days since created_at) doesn't read as if it's about an overdue
 * relance.
 */
export function daysSince(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

/** True when value is in the future but within the next `hours` hours. */
export function isWithinHours(value: string | null | undefined, hours: number): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = d.getTime() - Date.now();
  return diffMs >= 0 && diffMs <= hours * 60 * 60 * 1000;
}

/**
 * Extracts a human-readable message from a caught error. Supabase's
 * PostgrestError/AuthError objects carry a real `.message` (e.g.
 * "permission denied for table deals") but are not always `instanceof
 * Error`, so `err instanceof Error ? err.message : fallback` silently
 * discards the actual server error and shows only the generic fallback -
 * exactly what hid the missing-GRANT bug behind "Erreur de chargement."
 * Falls back to `fallback` only when nothing usable is found.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

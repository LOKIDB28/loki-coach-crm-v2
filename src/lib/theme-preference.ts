// One source of truth for the manual light/dark override - read by the
// anti-flash script in layout.tsx (via THEME_STORAGE_KEY, interpolated into
// that inline script's literal text since it runs before any JS module can
// load) and by ThemeToggle/Settings' "revenir au réglage de l'ordinateur"
// link. Never touches a database - purely a per-browser localStorage value.
//
// No React import here, deliberately: layout.tsx (a server component) needs
// THEME_STORAGE_KEY for the anti-flash script, and importing anything that
// pulls in useState/useEffect would force the whole module - this file -
// client-only, breaking that server import. The useEffectiveTheme() hook
// that actually calls those lives in use-effective-theme.ts instead.
//
// Every localStorage access is wrapped in try/catch: a blocked store
// (private browsing, disabled storage, a hostile extension) must never
// prevent the page from rendering - it just means the override doesn't
// persist across reloads, falling back to the system's own setting, same
// as before this feature existed.
export const THEME_STORAGE_KEY = "loki-theme";
export type ThemePreference = "light" | "dark";

// setStoredThemePreference/clearStoredThemePreference can be called from any
// of several independent component instances on the same page at once (the
// header's ThemeToggle, the mobile "..." menu's own row, Settings' "revenir
// au réglage de l'ordinateur" link) - each only ever updates ITS OWN
// in-memory state directly. Without this event, every other instance keeps
// showing its last-known value until something else (e.g. a system
// prefers-color-scheme change) happens to re-trigger it. The native
// "storage" event doesn't help here - it only fires in OTHER tabs/windows,
// never in the same document that made the change.
const THEME_CHANGE_EVENT = "loki-theme-change";

function notifyThemeChange() {
  try {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  } catch {
    // window unavailable or dispatch blocked - nothing to notify.
  }
}

/** Subscribes to any in-page theme change (any instance's toggle/reset) - returns an unsubscribe function. */
export function subscribeThemeChange(callback: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

export function getStoredThemePreference(): ThemePreference | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function setStoredThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage blocked - the attribute below still applies for the rest of
    // this session, it just won't survive a reload.
  }
  document.documentElement.setAttribute("data-theme", pref);
  notifyThemeChange();
}

/** "Revenir au réglage de l'ordinateur" - drops back to the system's own prefers-color-scheme, live, no reload. */
export function clearStoredThemePreference() {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Nothing was persisted anyway if this throws.
  }
  document.documentElement.removeAttribute("data-theme");
  notifyThemeChange();
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

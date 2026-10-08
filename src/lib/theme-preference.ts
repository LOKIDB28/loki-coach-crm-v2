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
}

/** "Revenir au réglage de l'ordinateur" - drops back to the system's own prefers-color-scheme, live, no reload. */
export function clearStoredThemePreference() {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Nothing was persisted anyway if this throws.
  }
  document.documentElement.removeAttribute("data-theme");
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

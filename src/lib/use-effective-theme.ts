"use client";

import { useEffect, useState } from "react";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  subscribeThemeChange,
  systemPrefersDark,
  type ThemePreference,
} from "@/lib/theme-preference";

function computeEffective(): ThemePreference {
  if (typeof window === "undefined") return "light";
  return getStoredThemePreference() ?? (systemPrefersDark() ? "dark" : "light");
}

/**
 * Shared between ThemeToggle (desktop header button, and every header that
 * renders it - Paramètres/Rapports/LOKI Intelligence) and the dashboard's
 * mobile "..." menu row - same reasoning the rest of this app already
 * applies to desktop/mobile pairs (duplicated JSX, shared logic): the two
 * render differently (icon-only button vs. a full labeled row) but must
 * stay in sync with each other and with the system setting, so the actual
 * state/listener logic lives in exactly one place.
 *
 * Each call site mounts its OWN instance of this hook (its own useState) -
 * there's no shared store, so a toggle fired from one instance (e.g. the
 * header button) doesn't by itself update any other instance's state on the
 * same page (e.g. the mobile menu row, or Settings' own read of whether a
 * preference is stored). subscribeThemeChange covers that: every instance
 * recomputes whenever ANY instance calls setStoredThemePreference/
 * clearStoredThemePreference, anywhere on the page.
 *
 * The lazy useState initializer (not a hardcoded "light") means `effective`
 * is already correct by the time any consumer's OWN first mounted render
 * reads it - no extra client-side flash on top of whatever that consumer
 * does for its own pre-hydration render. computeEffective() still returns
 * "light" during SSR (no window), so a consumer that renders its value
 * unconditionally (ignoring hydration) would still show that SSR default
 * for one frame - see ThemeToggle's own `mounted` gate for how it avoids
 * exactly that, by not rendering anything theme-dependent until mounted.
 *
 * Kept in its own "use client" file, separate from theme-preference.ts: that
 * module is imported by layout.tsx (a server component, for THEME_STORAGE_KEY
 * only) and must stay free of React hooks for that import to be legal.
 */
export function useEffectiveTheme() {
  const [effective, setEffective] = useState<ThemePreference>(computeEffective);

  useEffect(() => {
    function recompute() {
      setEffective(computeEffective());
    }
    recompute();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", recompute);
    const unsubscribe = subscribeThemeChange(recompute);
    return () => {
      mq.removeEventListener("change", recompute);
      unsubscribe();
    };
  }, []);

  function toggle() {
    const next: ThemePreference = effective === "dark" ? "light" : "dark";
    setStoredThemePreference(next);
    setEffective(next);
  }

  return { effective, toggle };
}

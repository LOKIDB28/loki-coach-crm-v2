"use client";

import { useEffect, useState } from "react";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  systemPrefersDark,
  type ThemePreference,
} from "@/lib/theme-preference";

/**
 * Shared between ThemeToggle (desktop header button) and the mobile "..."
 * menu's own toggle row - same reasoning the rest of this app already
 * applies to desktop/mobile pairs (duplicated JSX, shared logic): the two
 * render differently (icon-only button vs. a full labeled row) but must
 * stay in sync with each other and with the system setting, so the actual
 * state/listener logic lives in exactly one place.
 *
 * Kept in its own "use client" file, separate from theme-preference.ts: that
 * module is imported by layout.tsx (a server component, for THEME_STORAGE_KEY
 * only) and must stay free of React hooks for that import to be legal.
 */
export function useEffectiveTheme() {
  const [effective, setEffective] = useState<ThemePreference>("light");

  useEffect(() => {
    function recompute() {
      setEffective(getStoredThemePreference() ?? (systemPrefersDark() ? "dark" : "light"));
    }
    recompute();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", recompute);
    return () => mq.removeEventListener("change", recompute);
  }, []);

  function toggle() {
    const next: ThemePreference = effective === "dark" ? "light" : "dark";
    setStoredThemePreference(next);
    setEffective(next);
  }

  return { effective, toggle };
}

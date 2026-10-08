"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useEffectiveTheme } from "@/lib/use-effective-theme";

/**
 * Icon-only, no label to collapse - but still follows the same min-w-11
 * min-h-11 sm:min-w-0 sm:min-h-0 sm:px-2 sm:py-2 pattern as "Nouveau client"
 * and "Se déconnecter" (44px touch target below sm, shrinks to match the
 * row's other sm:py-2 buttons at sm+) - measured: without this, the fixed
 * 44px forced the header's actions row 10-16px taller than today at every
 * breakpoint from 640 to 1280, since a flex row sizes to its tallest child.
 * Defines no focus ring of its own - the global :focus-visible rule
 * (globals.css) applies, same reasoning as every other button in this app.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { effective, toggle } = useEffectiveTheme();
  const label = effective === "dark" ? "Passer en mode clair" : "Passer en mode sombre";

  // On Paramètres/Rapports/LOKI Intelligence (whose header renders
  // unconditionally, unlike the dashboard's own loading-gated header), the
  // server can't read localStorage/prefers-color-scheme at request time, so
  // the very first paint would otherwise always show the light icon even
  // when the real theme is dark - a brief wrong-icon flash right as
  // hydration corrects it. Gating the icon itself (not the button, which
  // keeps its full size throughout - no layout shift) behind `mounted`
  // means nothing is ever shown except the right icon: the icons are freshly
  // inserted into the DOM on that first mounted render, not transitioned
  // into from a previous frame, so no fade/rotate plays - that animation
  // only fires on an actual click afterward, when effective flips on an
  // already-mounted pair of icons.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:px-2 sm:py-2 rounded-lg text-textSoft hover:text-text transition-colors duration-150 ${className}`}
    >
      <span className="relative inline-flex items-center justify-center w-4 h-4">
        {mounted && (
          <>
            <Sun
              size={16}
              className={`absolute transition-[transform,opacity] duration-200 ${
                effective === "dark" ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
              }`}
            />
            <Moon
              size={16}
              className={`absolute transition-[transform,opacity] duration-200 ${
                effective === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
              }`}
            />
          </>
        )}
      </span>
    </button>
  );
}

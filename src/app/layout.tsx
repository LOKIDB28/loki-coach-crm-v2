import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_STORAGE_KEY } from "@/lib/theme-preference";

// Runs synchronously before first paint (a plain <script>, not a module -
// those are deferred) so a stored manual theme choice applies before any
// pixel is drawn, never a flash of the wrong theme then a correction.
// try/catch: a blocked localStorage (private browsing, disabled storage)
// must never stop the page from rendering - the system's own
// prefers-color-scheme still applies via globals.css either way, since
// this script only ever ADDS an attribute, never removes the CSS's own
// media-query fallback. No CSP is configured in this project (checked
// next.config.js and middleware.ts) - nothing blocks an inline script here.
const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(v==="light"||v==="dark"){document.documentElement.setAttribute("data-theme",v);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "LOKI CRM",
  description: "Suivi des ventes et du service pour motocoachs de luxe Prévost.",
  appleWebApp: {
    // "default" status bar style + our onyx header reads fine;
    // "black-translucent" would need the header to account for the status
    // bar overlapping content, which it doesn't right now.
    statusBarStyle: "default",
    title: "LOKI Coach",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    // appleWebApp.capable exists in Next's Metadata type but doesn't
    // actually emit this tag (verified against the built output) - without
    // it, "Add to Home Screen" opens in a regular Safari tab instead of
    // full-screen, which is the entire point of this section.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to resolve to anything other than
  // 0 - without viewport-fit=cover the bottom tab bar's safe-area padding
  // would be a no-op on notched/home-indicator iPhones.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning - this element's own data-theme attribute is
    // set by THEME_INIT_SCRIPT above, outside React's control and before
    // hydration; only suppresses mismatch warnings on html itself, not
    // recursively on its descendants.
    <html lang="fr-CA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}

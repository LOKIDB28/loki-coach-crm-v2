import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOKI Coach — CRM",
  description: "Suivi des ventes et du service pour motocoachs de luxe Prévost.",
  appleWebApp: {
    // "default" status bar style + our onyx header reads fine;
    // "black-translucent" would need the header to account for the status
    // bar overlapping content, which it doesn't right now.
    statusBarStyle: "default",
    title: "LOKI Coach",
  },
  icons: {
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
    <html lang="fr-CA">
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}

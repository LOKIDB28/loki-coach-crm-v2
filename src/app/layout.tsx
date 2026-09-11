import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOKI Coach — CRM",
  description: "Suivi des ventes et du service pour motocoachs de luxe Prévost.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr-CA">
      <body className="bg-bg text-text min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium">Une erreur est survenue.</p>
          <p className="text-sm opacity-70">L&apos;équipe a été notifiée automatiquement.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded px-4 py-2 border border-current text-sm"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

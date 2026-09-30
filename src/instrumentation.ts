import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Covers errors thrown from Server Components, Route Handlers and Server
// Actions that Next.js's own request lifecycle sees - NOT errors that a
// route handler catches itself and turns into a Response (e.g. the
// calendar feed's `if (error)` branch), which report explicitly instead.
export const onRequestError = Sentry.captureRequestError;

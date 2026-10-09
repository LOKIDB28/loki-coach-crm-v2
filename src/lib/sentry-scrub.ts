import type { ErrorEvent } from "@sentry/nextjs";

// The calendar feed (src/app/api/calendar/[token]/route.ts) treats its
// token as a bare credential - never logged, never echoed back. Sentry
// captures request URLs, referrers and breadcrumbs by default, which would
// undo that guarantee, so every Sentry.init() (client/server/edge) runs its
// events through this before sending.
const CALENDAR_TOKEN_IN_PATH = /(\/api\/calendar\/)[^/?#]+/i;

function scrubUrl(url: string): string {
  return url.replace(CALENDAR_TOKEN_IN_PATH, "$1[REDACTED]");
}

export function scrubCalendarToken(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }

  const referer = event.request?.headers?.["referer"] ?? event.request?.headers?.["Referer"];
  if (typeof referer === "string") {
    if (event.request?.headers?.["referer"]) event.request.headers["referer"] = scrubUrl(referer);
    if (event.request?.headers?.["Referer"]) event.request.headers["Referer"] = scrubUrl(referer);
  }

  // Set by Sentry's own captureRequestError (onRequestError in
  // instrumentation.ts) from the raw request path - token included - for
  // any exception the route handler doesn't catch itself.
  const nextjsContext = event.contexts?.nextjs;
  if (nextjsContext && typeof nextjsContext.request_path === "string") {
    nextjsContext.request_path = scrubUrl(nextjsContext.request_path);
  }

  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      const url = breadcrumb.data?.url;
      if (typeof url !== "string") return breadcrumb;
      return { ...breadcrumb, data: { ...breadcrumb.data, url: scrubUrl(url) } };
    });
  }

  return event;
}

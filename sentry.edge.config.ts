import * as Sentry from "@sentry/nextjs";
import { scrubCalendarToken } from "./src/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  beforeSend: scrubCalendarToken,
});

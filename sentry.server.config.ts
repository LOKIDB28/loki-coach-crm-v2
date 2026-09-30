import * as Sentry from "@sentry/nextjs";
import { scrubCalendarToken } from "./src/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // NODE_ENV is "production" on Vercel for Preview deployments too (only
  // `next dev` sets it to "development") - VERCEL_ENV is what actually
  // distinguishes "not deployed" from "deployed" (preview or production).
  enabled: process.env.VERCEL_ENV !== undefined,
  beforeSend: scrubCalendarToken,
});

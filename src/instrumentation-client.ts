import * as Sentry from "@sentry/nextjs";
import { scrubCalendarToken } from "./lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // NODE_ENV is "production" on Vercel for Preview deployments too (only
  // `next dev` sets it to "development") - NEXT_PUBLIC_VERCEL_ENV (the
  // client-exposed mirror of VERCEL_ENV) is what actually distinguishes
  // "not deployed" from "deployed" (preview or production).
  enabled: process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined,
  beforeSend: scrubCalendarToken,
});

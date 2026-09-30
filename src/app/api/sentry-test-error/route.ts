// TEMPORARY - end-to-end verification that a real thrown error in a Route
// Handler reaches Sentry + the email alert on this preview deployment.
// Delete this file before merging feat/sentry-error-tracking.
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  const error = new Error("Sentry preview verification - safe to ignore, route removed before merge");

  console.log("[sentry-test] captureException about to run");
  Sentry.captureException(error);
  console.log("[sentry-test] captureException done, flushing");

  // Vercel can freeze/terminate the function as soon as a response is sent -
  // without an explicit flush, the async network send to Sentry may never
  // complete. This is what actually proves delivery, independent of whether
  // the automatic instrumentation below also picks up the throw.
  const flushed = await Sentry.flush(2000);
  console.log(`[sentry-test] flush returned ${flushed}`);

  throw error;
}

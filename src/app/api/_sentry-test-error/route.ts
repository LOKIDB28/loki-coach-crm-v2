// TEMPORARY - end-to-end verification that a real thrown error in a Route
// Handler reaches Sentry + the email alert on this preview deployment.
// Delete this file before merging feat/sentry-error-tracking.
export async function GET() {
  throw new Error("Sentry preview verification - safe to ignore, route removed before merge");
}

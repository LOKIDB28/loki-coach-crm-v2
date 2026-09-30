const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // TEMPORARY while debugging the preview test - was `true`, which hides
  // every Sentry webpack-plugin log line (including failures) from the
  // Vercel build output, making it impossible to confirm the plugin ran.
  // Set back to true once delivery is confirmed working.
  silent: false,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});

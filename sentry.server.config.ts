import * as Sentry from "@sentry/nextjs";

// No-op until SENTRY_DSN is set in the environment (Railway → Variables).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Errors are the priority; keep performance sampling cheap.
  tracesSampleRate: 0.05,
});

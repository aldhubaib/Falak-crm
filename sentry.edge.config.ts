import * as Sentry from "@sentry/nextjs";

// Covers the middleware (Clerk auth) runtime. No-op until SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
});

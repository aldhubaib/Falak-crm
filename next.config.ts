import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Standalone bundle is for Railway production deploys only — enabling it in
  // dev makes Next trace extra files and costs RAM on every `npm run dev`.
  ...(process.env.NODE_ENV === "production"
    ? { output: "standalone" as const, outputFileTracingRoot: __dirname }
    : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      bodySizeLimit: "25mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
};

// Sentry wrapping is inert without SENTRY_DSN / SENTRY_AUTH_TOKEN — source-map
// upload only runs when the auth token is present in the build environment.
// Skip the wrapper entirely when no DSN is set: its loader injects
// `onRequestError` into instrumentation.ts and conflicts if we define our own.
const sentryOn = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

export default sentryOn
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
      widenClientFileUpload: false,
      telemetry: false,
    })
  : nextConfig;

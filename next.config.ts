import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Self-contained server bundle: `node .next/standalone/server.js` starts
  // without node_modules resolution at runtime — faster boot, less memory.
  output: "standalone",
  // Pin file tracing to this project so standalone lands at
  // .next/standalone/server.js (not nested under an inferred monorepo root).
  outputFileTracingRoot: __dirname,
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
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: false,
  telemetry: false,
});

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pingCache } from "@/lib/cache";
import { headBucket } from "@/lib/storage";

// Liveness/readiness probe for Railway (and manual checks). Only the database
// is load-bearing: a down DB returns 503 so the orchestrator can restart or
// hold traffic; degraded Redis/R2 are reported but stay 200 because the app
// has working fallbacks for both.

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  const [dbOk, redisOk, r2Ok] = await Promise.all([
    withTimeout(
      db.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      ),
      3000,
      false,
    ),
    withTimeout(pingCache(), 2000, false),
    withTimeout(headBucket(), 3000, false),
  ]);

  const ok = dbOk;
  return NextResponse.json(
    {
      ok,
      db: dbOk,
      redis: redisOk, // null = not configured (dev)
      r2: r2Ok,
      uptime: Math.round(process.uptime()),
    },
    { status: ok ? 200 : 503 },
  );
}

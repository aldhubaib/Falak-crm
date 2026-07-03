import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL ?? "";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// Pool size for the Postgres connection pool. Kept modest by default; raise via
// DB_POOL_MAX for higher concurrency (e.g. ~100 active users). SSE stream
// connections do NOT hold a pooled connection — they only query briefly at
// subscribe time — so they don't count against this budget.
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20);

function createClient() {
  const pool = globalForPrisma.pool ?? new pg.Pool({
    connectionString,
    max: POOL_MAX,
  });
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

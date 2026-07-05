/**
 * One-time backfill: assign sequential taskNumbers to tasks created before
 * numbering existed (they all sit at the default 0, rendering as "T-000").
 *
 * Numbers continue after each project's current max, ordered by creation
 * time, so existing numbered tasks keep their numbers. Safe to re-run.
 *
 * Run:  npx tsx scripts/backfill-task-numbers.ts
 *
 * Requires DATABASE_URL in your .env file.
 */
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const unnumbered = await db.task.findMany({
    where: { taskNumber: 0 },
    select: { id: true, projectId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${unnumbered.length} tasks without a number.`);
  if (unnumbered.length === 0) return;

  const projectIds = [...new Set(unnumbered.map((t) => t.projectId))];
  const maxes = await db.task.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds } },
    _max: { taskNumber: true },
  });
  const nextByProject = new Map(
    maxes.map((m) => [m.projectId, (m._max.taskNumber ?? 0) + 1]),
  );

  let updated = 0;
  for (const t of unnumbered) {
    const next = nextByProject.get(t.projectId) ?? 1;
    nextByProject.set(t.projectId, next + 1);
    await db.task.update({
      where: { id: t.id },
      data: { taskNumber: next },
    });
    updated++;
  }
  console.log(`Numbered ${updated} tasks across ${projectIds.length} projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

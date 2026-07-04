/**
 * One-time backfill after unifying TaskComment -> Message.
 *
 * Populates Message.projectId (denormalized from the task) so existing task
 * comments/rejections show up in the project "Everything" feed. Safe to re-run.
 *
 * Run:  npx tsx scripts/backfill-messages.ts
 *
 * Requires DATABASE_URL in your .env file.
 *
 * Note: we intentionally do NOT retro-tag kind="rejection" on historical rows —
 * there is no reliable signal (normal @mentions look identical). New rejections
 * are tagged correctly at write time by sendMessage/the decline flow.
 */
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const orphans = await db.message.findMany({
    where: { projectId: null, taskId: { not: null } },
    select: { id: true, taskId: true },
  });

  console.log(`Found ${orphans.length} messages missing projectId.`);

  const taskIds = [...new Set(orphans.map((m) => m.taskId!))];
  const tasks = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, projectId: true },
  });
  const taskToProject = new Map(tasks.map((t) => [t.id, t.projectId]));

  let updated = 0;
  for (const m of orphans) {
    const projectId = taskToProject.get(m.taskId!);
    if (!projectId) continue;
    await db.message.update({ where: { id: m.id }, data: { projectId } });
    updated++;
  }

  console.log(`Backfilled projectId on ${updated} messages.`);
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

/**
 * One-time cleanup: normalize allowedFormats on checklist template items and
 * task checklist items. Old editors saved extensions inconsistently ("png"
 * vs ".png", mixed case) and re-saving a field stacked duplicates, so the
 * dropzone showed chips like ".mp4 .mp4" or ".jpeg .png .jpg .png .jpg".
 *
 * Rewrites each stored array as lowercase, dot-prefixed, deduplicated JSON.
 * Safe to re-run.
 *
 * Run:  npx tsx scripts/normalize-formats.ts
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

function dotExt(f: string): string {
  const t = f.trim().toLowerCase();
  if (!t) return "";
  return t.startsWith(".") ? t : `.${t}`;
}

function parseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function normalized(raw: string | null): string | null {
  const list = [...new Set(parseArray(raw).map(dotExt).filter(Boolean))];
  if (list.length === 0) return null;
  return JSON.stringify(list);
}

async function main() {
  let templateFixed = 0;
  const templateItems = await db.checklistTemplateItem.findMany({
    where: { allowedFormats: { not: null } },
    select: { id: true, allowedFormats: true },
  });
  for (const item of templateItems) {
    const next = normalized(item.allowedFormats);
    if (next !== item.allowedFormats) {
      await db.checklistTemplateItem.update({
        where: { id: item.id },
        data: { allowedFormats: next },
      });
      templateFixed++;
    }
  }
  console.log(
    `Template items: ${templateItems.length} checked, ${templateFixed} normalized.`,
  );

  let taskFixed = 0;
  const taskItems = await db.taskChecklistItem.findMany({
    where: { allowedFormats: { not: null } },
    select: { id: true, allowedFormats: true },
  });
  for (const item of taskItems) {
    const next = normalized(item.allowedFormats);
    if (next !== item.allowedFormats) {
      await db.taskChecklistItem.update({
        where: { id: item.id },
        data: { allowedFormats: next },
      });
      taskFixed++;
    }
  }
  console.log(
    `Task checklist items: ${taskItems.length} checked, ${taskFixed} normalized.`,
  );
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

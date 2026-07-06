// One-time backfill: template fields added before addChecklistTemplateItem
// started propagating to existing tasks are missing from those tasks. For
// every task built from a template, insert task checklist items for any
// template item the task doesn't have yet.
//
//   DATABASE_URL=<url> npx tsx --env-file=.env scripts/backfill-template-fields.ts
import { db } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma";

async function main() {
  const templates = await db.checklistTemplate.findMany({
    include: { items: true },
  });

  let inserted = 0;
  for (const template of templates) {
    if (template.items.length === 0) continue;
    const itemIds = template.items.map((i) => i.id);

    // Tasks that were built from this template (have at least one of its items).
    const taskRows = await db.taskChecklistItem.findMany({
      where: { templateItemId: { in: itemIds } },
      select: { taskId: true, templateItemId: true },
    });

    const byTask = new Map<string, Set<string>>();
    for (const row of taskRows) {
      if (!row.templateItemId) continue;
      const set = byTask.get(row.taskId) ?? new Set<string>();
      set.add(row.templateItemId);
      byTask.set(row.taskId, set);
    }

    const toCreate: Prisma.TaskChecklistItemCreateManyInput[] = [];

    for (const [taskId, existing] of byTask) {
      for (const item of template.items) {
        if (existing.has(item.id)) continue;
        toCreate.push({
          taskId,
          templateItemId: item.id,
          name: item.name,
          type: item.type,
          role: item.role,
          options: item.options,
          allowedFileTypes: item.allowedFileTypes,
          allowedFormats: item.allowedFormats,
          aspectRatio: item.aspectRatio,
          mandatory: item.mandatory,
          phase: item.phase,
          visibleFromStageId: item.visibleFromStageId,
          requiredBeforeStageId: item.requiredBeforeStageId,
          lockedFromStageId: item.lockedFromStageId,
          neverLock: item.neverLock,
          publishCard: item.publishCard,
          order: item.order,
        });
      }
    }

    if (toCreate.length > 0) {
      await db.taskChecklistItem.createMany({ data: toCreate });
      inserted += toCreate.length;
      console.log(`${template.name}: added ${toCreate.length} missing field(s)`);
    }
  }

  console.log(`Done — ${inserted} task field(s) inserted.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

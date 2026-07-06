// One-time repair: task checklist rows whose template field was deleted (the
// FK is SetNull) are detached — they can never follow settings changes. When
// the field was later recreated with the same name (like the Copyright
// incident), relink the orphan to the new template item, but only when the
// match is unambiguous and the task doesn't already have that field.
//
//   DATABASE_URL=<url> npx tsx scripts/relink-orphan-fields.ts
import { db } from "../src/lib/db";

async function main() {
  const orphans = await db.taskChecklistItem.findMany({
    where: { templateItemId: null },
    select: { id: true, taskId: true, name: true },
  });
  if (orphans.length === 0) {
    console.log("No orphaned task fields — nothing to do.");
    return;
  }
  console.log(`Found ${orphans.length} orphaned task field(s).`);

  const taskIds = [...new Set(orphans.map((o) => o.taskId))];
  const linked = await db.taskChecklistItem.findMany({
    where: { taskId: { in: taskIds }, templateItemId: { not: null } },
    select: {
      taskId: true,
      templateItemId: true,
      templateItem: { select: { templateId: true } },
    },
  });

  // Which templates each task was built from, and which template items it
  // already has, derived from its still-linked rows.
  const templatesByTask = new Map<string, Set<string>>();
  const linkedItemsByTask = new Map<string, Set<string>>();
  for (const l of linked) {
    if (!l.templateItem) continue;
    (templatesByTask.get(l.taskId) ?? templatesByTask.set(l.taskId, new Set()).get(l.taskId)!)
      .add(l.templateItem.templateId);
    (linkedItemsByTask.get(l.taskId) ?? linkedItemsByTask.set(l.taskId, new Set()).get(l.taskId)!)
      .add(l.templateItemId!);
  }

  const allTemplateIds = [...new Set(linked.map((l) => l.templateItem?.templateId).filter(Boolean))] as string[];
  const templateItems = await db.checklistTemplateItem.findMany({
    where: { templateId: { in: allTemplateIds } },
    select: { id: true, templateId: true, name: true },
  });

  let relinked = 0;
  let skipped = 0;
  for (const orphan of orphans) {
    const taskTemplates = templatesByTask.get(orphan.taskId);
    if (!taskTemplates) {
      console.log(`  skip "${orphan.name}" (${orphan.id}): task has no linked fields to infer its template`);
      skipped++;
      continue;
    }
    const candidates = templateItems.filter(
      (ti) =>
        taskTemplates.has(ti.templateId) &&
        ti.name.trim().toLowerCase() === orphan.name.trim().toLowerCase(),
    );
    if (candidates.length !== 1) {
      console.log(`  skip "${orphan.name}" (${orphan.id}): ${candidates.length} matching template field(s)`);
      skipped++;
      continue;
    }
    const candidate = candidates[0];
    if (linkedItemsByTask.get(orphan.taskId)?.has(candidate.id)) {
      console.log(`  skip "${orphan.name}" (${orphan.id}): task already has this field linked — duplicate row, review manually`);
      skipped++;
      continue;
    }
    await db.taskChecklistItem.update({
      where: { id: orphan.id },
      data: { templateItemId: candidate.id },
    });
    linkedItemsByTask.get(orphan.taskId)?.add(candidate.id);
    relinked++;
  }

  console.log(`Done — relinked ${relinked}, skipped ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

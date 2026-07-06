// One-time rescue: the "Copyright" template field on "Short Ai Story 9:16" was
// deleted by mistake (task items survived as orphans, templateItemId = null)
// and a fresh empty "Copyright" field was created in its place.
//
// This script:
//   1. Recreates the template item with the old config (from an orphan row).
//   2. Relinks the orphaned task items (with their answers) to it.
//   3. Removes the duplicate empty items created by the new field — except on
//      tasks that never had the old field, where the empty item is relinked
//      instead so the field isn't lost there.
//   4. Deletes the accidental new template item.
//
//   DATABASE_URL=<url> npx tsx scripts/restore-copyright.ts
import { db } from "../src/lib/db";

const NEW_ITEM_ID = "cmr9chape00002jmzo970khzb";

async function main() {
  const newItem = await db.checklistTemplateItem.findUnique({
    where: { id: NEW_ITEM_ID },
  });
  if (!newItem) throw new Error("New Copyright template item not found — already cleaned up?");

  const orphans = await db.taskChecklistItem.findMany({
    where: { templateItemId: null, name: { equals: "Copyright", mode: "insensitive" } },
  });
  if (orphans.length === 0) throw new Error("No orphaned Copyright task items found");
  const sample = orphans[0];
  console.log(`Found ${orphans.length} orphaned Copyright answers; sample config:`, {
    type: sample.type,
    mandatory: sample.mandatory,
    phase: sample.phase,
    role: sample.role,
  });

  await db.$transaction(async (tx) => {
    // 1. Recreate the old field with its original config, in the slot the
    //    replacement currently occupies.
    const restored = await tx.checklistTemplateItem.create({
      data: {
        templateId: newItem.templateId,
        name: sample.name,
        type: sample.type,
        role: sample.role,
        options: sample.options,
        allowedFileTypes: sample.allowedFileTypes,
        allowedFormats: sample.allowedFormats,
        aspectRatio: sample.aspectRatio,
        mandatory: sample.mandatory,
        phase: sample.phase,
        visibleFromStageId: sample.visibleFromStageId,
        requiredBeforeStageId: sample.requiredBeforeStageId,
        lockedFromStageId: sample.lockedFromStageId,
        neverLock: sample.neverLock,
        publishCard: sample.publishCard,
        order: newItem.order,
      },
    });
    console.log("Recreated template item:", restored.id);

    // 2. Relink the orphaned answers.
    const relinked = await tx.taskChecklistItem.updateMany({
      where: { id: { in: orphans.map((o) => o.id) } },
      data: { templateItemId: restored.id, order: newItem.order },
    });
    console.log(`Relinked ${relinked.count} orphaned answers`);

    // 3. Handle the empty duplicates from the new field.
    const dupes = await tx.taskChecklistItem.findMany({
      where: { templateItemId: NEW_ITEM_ID },
    });
    const tasksWithOrphan = new Set(orphans.map((o) => o.taskId));
    const toDelete: string[] = [];
    const keptTaskIds = new Set<string>();
    const toRelink: string[] = [];
    for (const d of dupes) {
      const hasData = !!d.textValue?.trim() || !!d.attachmentId || d.completed;
      if (tasksWithOrphan.has(d.taskId) || keptTaskIds.has(d.taskId)) {
        if (hasData) {
          console.warn(`  keeping unexpected filled duplicate ${d.id} on task ${d.taskId}`);
          continue;
        }
        toDelete.push(d.id);
      } else {
        // Task never had the old field — keep this row, move it to the
        // restored field and adopt the restored config.
        toRelink.push(d.id);
        keptTaskIds.add(d.taskId);
      }
    }
    if (toDelete.length > 0) {
      await tx.taskChecklistItem.deleteMany({ where: { id: { in: toDelete } } });
      console.log(`Deleted ${toDelete.length} empty duplicate rows`);
    }
    if (toRelink.length > 0) {
      await tx.taskChecklistItem.updateMany({
        where: { id: { in: toRelink } },
        data: {
          templateItemId: restored.id,
          mandatory: sample.mandatory,
          order: newItem.order,
        },
      });
      console.log(`Relinked ${toRelink.length} rows on tasks that lacked the old field`);
    }

    // 4. Remove the accidental new template item.
    await tx.checklistTemplateItem.delete({ where: { id: NEW_ITEM_ID } });
    console.log("Deleted the duplicate template item");
  });

  // Sanity: every Copyright task item should now point at the restored field.
  const leftOrphans = await db.taskChecklistItem.count({
    where: { templateItemId: null, name: { equals: "Copyright", mode: "insensitive" } },
  });
  console.log(`Remaining orphans: ${leftOrphans}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

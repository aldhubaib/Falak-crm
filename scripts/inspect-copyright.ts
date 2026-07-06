// Diagnostic: find Copyright template items and task items (incl. orphans left
// by the accidental template-field deletion — templateItemId is SetNull).
import { db } from "../src/lib/db";

async function main() {
  const templateItems = await db.checklistTemplateItem.findMany({
    where: { name: { contains: "copyright", mode: "insensitive" } },
    include: { template: { select: { name: true } } },
  });
  console.log("--- Template items named Copyright ---");
  for (const t of templateItems) {
    console.log({
      id: t.id,
      template: t.template.name,
      type: t.type,
      mandatory: t.mandatory,
      phase: t.phase,
      order: t.order,
      publishCard: t.publishCard,
    });
  }

  const taskItems = await db.taskChecklistItem.findMany({
    where: { name: { contains: "copyright", mode: "insensitive" } },
    select: {
      id: true,
      taskId: true,
      templateItemId: true,
      type: true,
      mandatory: true,
      phase: true,
      order: true,
      textValue: true,
      attachmentId: true,
      completed: true,
      visibleFromStageId: true,
      requiredBeforeStageId: true,
      lockedFromStageId: true,
      neverLock: true,
      publishCard: true,
      role: true,
      options: true,
      task: { select: { title: true } },
    },
  });
  console.log(`--- Task items named Copyright (${taskItems.length}) ---`);
  for (const t of taskItems) {
    console.log({
      id: t.id,
      task: t.task.title,
      templateItemId: t.templateItemId,
      type: t.type,
      mandatory: t.mandatory,
      order: t.order,
      textValue: t.textValue,
      completed: t.completed,
      hasAttachment: !!t.attachmentId,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

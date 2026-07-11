// One-time backfill: the task page used to hide delivery-phase sections as a
// blanket rule until the task left Todo. That rule is gone — visibility is now
// purely per-field ("Visible From"). To keep existing delivery fields behaving
// the same, set their Visible From to the first stage after Todo when they
// don't have one already.
//
//   DATABASE_URL=<url> npx tsx scripts/backfill-delivery-visibility.ts
import { db } from "../src/lib/db";

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } });

  for (const ws of workspaces) {
    const stages = await db.taskStatus.findMany({
      where: { workspaceId: ws.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true },
    });
    const todo = stages.find((s) => s.name.toLowerCase() === "todo");
    const firstAfterTodo = todo
      ? stages.find((s) => s.order > todo.order)
      : undefined;
    if (!firstAfterTodo) {
      console.log(`Workspace ${ws.id}: no stage after Todo, skipped.`);
      continue;
    }

    const tpl = await db.checklistTemplateItem.updateMany({
      where: {
        template: { workspaceId: ws.id },
        phase: "delivery",
        visibleFromStageId: null,
      },
      data: { visibleFromStageId: firstAfterTodo.id },
    });

    // Detached task items (no template link) resolve config from their own
    // row, so they need the value directly. Linked items follow the template.
    const detached = await db.taskChecklistItem.updateMany({
      where: {
        task: { project: { workspaceId: ws.id } },
        templateItemId: null,
        phase: "delivery",
        visibleFromStageId: null,
      },
      data: { visibleFromStageId: firstAfterTodo.id },
    });

    console.log(
      `Workspace ${ws.id}: ${tpl.count} template field(s) + ${detached.count} detached task field(s) → Visible From "${firstAfterTodo.name}".`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

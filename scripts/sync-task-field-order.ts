// One-time sync: task checklist items snapshot order/phase at creation, and
// template reorders done before the reorder-sync existed never propagated.
// Copy the CURRENT template order + phase onto every linked task item.
//
//   DATABASE_URL=<url> npx tsx scripts/sync-task-field-order.ts
import { db } from "../src/lib/db";

async function main() {
  const templateItems = await db.checklistTemplateItem.findMany({
    select: { id: true, order: true, phase: true },
  });

  let updated = 0;
  for (const item of templateItems) {
    const res = await db.taskChecklistItem.updateMany({
      where: {
        templateItemId: item.id,
        OR: [{ order: { not: item.order } }, { phase: { not: item.phase } }],
      },
      data: { order: item.order, phase: item.phase },
    });
    updated += res.count;
  }

  console.log(`Done — ${updated} task field(s) resynced to template order/phase.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

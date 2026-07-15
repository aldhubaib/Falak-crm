// Kanban weekly-slot QA harness. Isolated throwaway workspace; exercises slot
// seeding, top-up, admin-removal persistence, and Todo-task adoption — the
// data layer behind the board's dashed placeholders.
//
//   npx tsx --env-file=.env scripts/qa-kanban-slots.ts
import { db } from "../src/lib/db";
import { ensureWeeklySlots } from "../src/lib/weekly-slots";
import { planningWeekStartOf } from "../src/lib/week";

let failures = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const stamp = Date.now();
  const ws = await db.workspace.create({
    data: { name: `QA Slots ${stamp}`, slug: `qa-slots-${stamp}` },
  });

  try {
    await db.taskStatus.create({
      data: { workspaceId: ws.id, name: "Todo", order: 0 },
    });
    const template = await db.checklistTemplate.create({
      data: { workspaceId: ws.id, name: "QA Video" },
    });
    const templateItem = await db.checklistTemplateItem.create({
      data: { templateId: template.id, name: "Field", type: "text" },
    });
    const member = await db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: `qa-slots-${stamp}`,
        email: `qa-slots-${stamp}@test.local`,
        name: "QA Member",
      },
    });
    const project = await db.project.create({
      data: { workspaceId: ws.id, name: "QA Project" },
    });
    await db.projectWeeklyTarget.create({
      data: {
        projectId: project.id,
        templateId: template.id,
        perWeek: 5,
        responsibleMemberId: member.id,
      },
    });

    const weekStart = planningWeekStartOf();
    const slotCount = () =>
      db.weeklySlot.count({ where: { projectId: project.id, weekStart } });

    // ── 1. First board load seeds slots to target ──────────────────────────
    console.log("\n[1] Slot seeding");
    await ensureWeeklySlots(project.id);
    check("5 slots created for a 5/wk target", (await slotCount()) === 5, await slotCount());

    const seeded = await db.weeklySlot.findMany({
      where: { projectId: project.id, weekStart },
    });
    check("slots carry the responsible member", seeded.every((s) => s.assigneeId === member.id));

    // ── 2. Re-run is idempotent (throttle window expires after 10s) ────────
    console.log("\n[2] Idempotency (waiting out the 10s throttle)");
    await sleep(11_000);
    await ensureWeeklySlots(project.id);
    check("second run adds nothing", (await slotCount()) === 5, await slotCount());

    // ── 3. Admin removal is not resurrected; target bump adds the diff ─────
    console.log("\n[3] Removal persistence + target bump");
    const victim = seeded[0];
    await db.weeklySlot.update({
      where: { id: victim.id },
      data: { removedAt: new Date() },
    });
    await db.projectWeeklyTarget.update({
      where: { projectId_templateId: { projectId: project.id, templateId: template.id } },
      data: { perWeek: 6 },
    });
    await sleep(11_000);
    await ensureWeeklySlots(project.id);
    const total = await slotCount();
    const removed = await db.weeklySlot.count({
      where: { projectId: project.id, weekStart, removedAt: { not: null } },
    });
    check("bump 5→6 adds exactly 1 (removed row still counts)", total === 6, total);
    check("removed slot stays removed", removed === 1, removed);

    // ── 4. Unbound Todo task is adopted into a free slot ───────────────────
    console.log("\n[4] Todo task adoption");
    const task = await db.task.create({
      data: {
        projectId: project.id,
        title: "QA Todo Task",
        statusId: (await db.taskStatus.findFirst({ where: { workspaceId: ws.id } }))!.id,
      },
    });
    await db.taskChecklistItem.create({
      data: {
        taskId: task.id,
        templateItemId: templateItem.id,
        name: templateItem.name,
        type: templateItem.type,
      },
    });
    await sleep(11_000);
    await ensureWeeklySlots(project.id);
    const claimed = await db.weeklySlot.findFirst({ where: { taskId: task.id } });
    check("task claimed one slot", !!claimed);
    const empty = await db.weeklySlot.count({
      where: { projectId: project.id, weekStart, taskId: null, removedAt: null },
    });
    check("empty slot count dropped to 4", empty === 4, empty);
  } finally {
    await db.workspace.delete({ where: { id: ws.id } });
    console.log("\nCleanup: QA workspace deleted.");
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll kanban slot QA checks passed.");
}

main().finally(() => db.$disconnect());

// QA for the Todo weekly-plan gate mechanics added this cycle: plan-cycle
// deadlines (cycleEndOf), stored task types on zero-field templates, race-safe
// slot claiming, and slot adoption via Task.templateId. Isolated throwaway
// workspace; asserts the rest of the database is untouched.
//
//   npx tsx --env-file=.env scripts/qa-todo-gate.ts
import { db } from "../src/lib/db";
import { ensureWeeklySlots } from "../src/lib/weekly-slots";
import { weekStartOf } from "../src/lib/week";
import { cycleEndOf } from "../src/lib/weekly-plan";

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

// Everything the recent features write to — snapshot before/after to prove
// the QA (and by extension the new code paths) never touches existing data.
async function snapshot() {
  const [tasks, completed, items, locked, attachments, slots, targets] =
    await Promise.all([
      db.task.count(),
      db.task.count({ where: { completedAt: { not: null } } }),
      db.taskChecklistItem.count(),
      db.taskChecklistItem.count({ where: { effortLockedAt: { not: null } } }),
      db.attachment.count(),
      db.weeklySlot.count(),
      db.projectWeeklyTarget.count(),
    ]);
  return { tasks, completed, items, locked, attachments, slots, targets };
}

async function main() {
  const before = await snapshot();
  const stamp = Date.now();
  const ws = await db.workspace.create({
    data: { name: `QA Gate ${stamp}`, slug: `qa-gate-${stamp}` },
  });

  try {
    // ── 1. cycleEndOf: plan-cycle deadlines ─────────────────────────────────
    console.log("\n[1] cycleEndOf deadlines");
    const anchor = new Date("2026-07-05T00:00:00Z");
    const now = new Date("2026-07-11T00:00:00Z");
    const weekEnd = cycleEndOf(anchor, "week", now);
    check(
      "weekly plan started Jul 5 -> cycle ends Jul 12",
      weekEnd.toISOString().startsWith("2026-07-12"),
      weekEnd.toISOString(),
    );
    const monthEnd = cycleEndOf(anchor, "month", now);
    check(
      "monthly plan started Jul 5 -> cycle ends Aug 5",
      monthEnd.toISOString().startsWith("2026-08-05"),
      monthEnd.toISOString(),
    );
    const oldAnchor = new Date("2020-01-06T00:00:00Z");
    const oldEnd = cycleEndOf(oldAnchor, "week", now);
    check(
      "plan started years ago still lands in the current week",
      oldEnd > now && oldEnd.getTime() - now.getTime() <= 7 * 86_400_000,
      oldEnd.toISOString(),
    );

    // ── 2. Zero-field task type adoption via stored Task.templateId ────────
    console.log("\n[2] Zero-field type adoption (T-014 regression)");
    await db.taskStatus.create({
      data: { workspaceId: ws.id, name: "Todo", order: 0 },
    });
    const bareTemplate = await db.checklistTemplate.create({
      data: { workspaceId: ws.id, name: "QA Bare Type" }, // zero fields
    });
    const member = await db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: `qa-gate-${stamp}`,
        email: `qa-gate-${stamp}@test.local`,
        name: "QA Member",
      },
    });
    const project = await db.project.create({
      data: { workspaceId: ws.id, name: "QA Gate Project" },
    });
    await db.projectWeeklyTarget.create({
      data: {
        projectId: project.id,
        templateId: bareTemplate.id,
        perWeek: 2,
        responsibleMemberId: member.id,
      },
    });
    const todo = (await db.taskStatus.findFirst({
      where: { workspaceId: ws.id },
    }))!;
    // Task of the bare type sitting in Todo, unbound — before Task.templateId
    // existed this task was invisible to adoption (no checklist rows).
    const bareTask = await db.task.create({
      data: {
        projectId: project.id,
        title: "Bare-type task",
        statusId: todo.id,
        templateId: bareTemplate.id,
      },
    });
    await ensureWeeklySlots(project.id);
    const adopted = await db.weeklySlot.findFirst({
      where: { taskId: bareTask.id },
    });
    check("zero-field-type task adopted into a plan slot", !!adopted);

    // ── 3. Race-safe slot claiming ──────────────────────────────────────────
    console.log("\n[3] Concurrent claim of one slot");
    const weekStart = weekStartOf(new Date(), "Asia/Kuwait");
    const freeSlot = await db.weeklySlot.findFirst({
      where: {
        projectId: project.id,
        weekStart,
        taskId: null,
        removedAt: null,
      },
    });
    check("one free slot remains (target 2, one adopted)", !!freeSlot);
    if (freeSlot) {
      const [taskA, taskB] = await Promise.all([
        db.task.create({
          data: {
            projectId: project.id,
            title: "Racer A",
            statusId: todo.id,
            templateId: bareTemplate.id,
          },
        }),
        db.task.create({
          data: {
            projectId: project.id,
            title: "Racer B",
            statusId: todo.id,
            templateId: bareTemplate.id,
          },
        }),
      ]);
      // Both moves resolved the same free slot; the conditional update the
      // move transaction uses (taskId: null guard) must let exactly one win.
      const [a, b] = await Promise.all([
        db.weeklySlot.updateMany({
          where: { id: freeSlot.id, taskId: null },
          data: { taskId: taskA.id },
        }),
        db.weeklySlot.updateMany({
          where: { id: freeSlot.id, taskId: null },
          data: { taskId: taskB.id },
        }),
      ]);
      check(
        "exactly one concurrent claim wins",
        a.count + b.count === 1,
        { a: a.count, b: b.count },
      );
    }

    // ── 4. Unique constraint blocks duplicate materialisation ──────────────
    console.log("\n[4] Duplicate checklist rows blocked");
    const fieldTemplate = await db.checklistTemplate.create({
      data: { workspaceId: ws.id, name: "QA Field Type" },
    });
    const tplItem = await db.checklistTemplateItem.create({
      data: { templateId: fieldTemplate.id, name: "Field", type: "text" },
    });
    const task = await db.task.create({
      data: {
        projectId: project.id,
        title: "Dup target",
        statusId: todo.id,
        templateId: fieldTemplate.id,
      },
    });
    const mk = () =>
      db.taskChecklistItem.createMany({
        data: [
          {
            taskId: task.id,
            templateItemId: tplItem.id,
            name: "Field",
            type: "text",
          },
        ],
        skipDuplicates: true,
      });
    await mk();
    const second = await mk();
    const rows = await db.taskChecklistItem.count({
      where: { taskId: task.id, templateItemId: tplItem.id },
    });
    check("second materialisation is a no-op", second.count === 0 && rows === 1, {
      second: second.count,
      rows,
    });

    // ── 5. Deleting a slot-bound task frees the slot (SetNull FK) ──────────
    console.log("\n[5] Task delete releases its slot");
    if (adopted) {
      await db.task.delete({ where: { id: bareTask.id } });
      const after = await db.weeklySlot.findUnique({
        where: { id: adopted.id },
        select: { taskId: true },
      });
      check("slot taskId reset to null", after?.taskId === null, after);
    }
  } finally {
    await db.workspace.delete({ where: { id: ws.id } });
    console.log("\nCleanup: QA workspace deleted.");
  }

  // ── 6. Existing data untouched ────────────────────────────────────────────
  console.log("\n[6] Data preservation");
  await sleep(500);
  const after = await snapshot();
  check(
    "no pre-existing rows gained or lost",
    JSON.stringify(before) === JSON.stringify(after),
    { before, after },
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Todo-gate QA checks passed.");
}

main().finally(() => db.$disconnect());

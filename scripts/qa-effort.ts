// Effort-logic QA harness. Creates an isolated throwaway workspace, exercises
// the live/locked effort pipeline end-to-end, and deletes everything after.
// Safe to run against the dev database — it never touches existing rows.
//
//   npx tsx --env-file=.env scripts/qa-effort.ts
import { db } from "../src/lib/db";
import { computeTaskEffort } from "../src/lib/effort";
import {
  lockTaskEffortLocks,
  clearTaskEffortLocks,
  recalculateTaskEffortLocks,
  recalculateTitleEffortLocks,
} from "../src/lib/effort-lock";

let failures = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

function approx(a: number | null | undefined, b: number, eps = 1e-6): boolean {
  return a != null && Math.abs(a - b) < eps;
}

async function main() {
  const stamp = Date.now();
  const ws = await db.workspace.create({
    data: { name: `QA Effort ${stamp}`, slug: `qa-effort-${stamp}` },
  });

  try {
    // ── Fixture ────────────────────────────────────────────────────────────
    const [todo, review, completed] = await Promise.all([
      db.taskStatus.create({ data: { workspaceId: ws.id, name: "Todo", order: 0 } }),
      db.taskStatus.create({ data: { workspaceId: ws.id, name: "Final Video Check", order: 1 } }),
      db.taskStatus.create({ data: { workspaceId: ws.id, name: "Completed", order: 2 } }),
    ]);

    const template = await db.checklistTemplate.create({
      data: { workspaceId: ws.id, name: "QA Video" },
    });
    const [wordsItem, audioItem, multiVideoItem, fixedItem] = await Promise.all([
      db.checklistTemplateItem.create({
        data: { templateId: template.id, name: "Transcript", type: "textarea", effortUnit: "words", order: 0 },
      }),
      db.checklistTemplateItem.create({
        data: { templateId: template.id, name: "Voice Over", type: "file_upload", effortUnit: "audio_min", order: 1 },
      }),
      db.checklistTemplateItem.create({
        data: { templateId: template.id, name: "Raw Footage", type: "multi_file", effortUnit: "video_min", order: 2 },
      }),
      db.checklistTemplateItem.create({
        data: { templateId: template.id, name: "Poster", type: "file_upload", effortUnit: "fixed", order: 3 },
      }),
    ]);

    const title = await db.title.create({
      data: {
        workspaceId: ws.id,
        name: "QA Senior",
        fieldRates: {
          create: [
            { templateItemId: wordsItem.id, minutesPerUnit: 100 },
            { templateItemId: audioItem.id, minutesPerUnit: 1 },
            { templateItemId: multiVideoItem.id, minutesPerUnit: 60 },
            { templateItemId: fixedItem.id, minutesPerUnit: 10 },
          ],
        },
        stageRates: { create: [{ statusId: review.id, minutesPerPass: 15 }] },
      },
    });

    const doer = await db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: `qa-doer-${stamp}`,
        email: `qa-doer-${stamp}@test.local`,
        name: "QA Doer",
        titleId: title.id,
      },
    });
    const reviewer = await db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: `qa-reviewer-${stamp}`,
        email: `qa-reviewer-${stamp}@test.local`,
        name: "QA Reviewer",
        titleId: title.id,
      },
    });

    const project = await db.project.create({
      data: { workspaceId: ws.id, name: "QA Project" },
    });
    const task = await db.task.create({
      data: {
        projectId: project.id,
        title: "QA Task",
        statusId: review.id,
        assigneeId: doer.id,
      },
    });

    // Attachments: single audio 147.6s (2.46 min), two video files 60s+87.6s
    // (2.46 min total), one with unknown duration to trip the flag.
    const audioAtt = await db.attachment.create({
      data: {
        workspaceId: ws.id, entityType: "task", entityId: task.id,
        name: "vo.mp3", status: "uploaded", durationSec: 147.6,
      },
    });

    const now = new Date();
    const mkItem = (ti: { id: string; name: string; type: string; effortUnit: string | null }, extra: object) =>
      db.taskChecklistItem.create({
        data: {
          taskId: task.id,
          templateItemId: ti.id,
          name: ti.name,
          type: ti.type,
          effortUnit: ti.effortUnit,
          ...extra,
        },
      });

    const [wordsCi, audioCi, multiCi, fixedCi] = [
      await mkItem(wordsItem, {
        textValue: Array.from({ length: 264 }, (_, i) => `w${i}`).join(" "),
        completed: true, completedAt: now, completedBy: doer.id,
      }),
      await mkItem(audioItem, {
        attachmentId: audioAtt.id,
        completed: true, completedAt: now, completedBy: doer.id,
      }),
      await mkItem(multiVideoItem, {
        completed: true, completedAt: now, completedBy: doer.id,
      }),
      await mkItem(fixedItem, { completed: false }),
    ];

    await db.attachment.createMany({
      data: [
        {
          workspaceId: ws.id, entityType: "checklist_item", entityId: multiCi.id,
          name: "clip1.mp4", status: "uploaded", durationSec: 60,
        },
        {
          workspaceId: ws.id, entityType: "checklist_item", entityId: multiCi.id,
          name: "clip2.mp4", status: "uploaded", durationSec: 87.6,
        },
        {
          workspaceId: ws.id, entityType: "checklist_item", entityId: multiCi.id,
          name: "clip3.mp4", status: "uploaded", durationSec: null,
        },
      ],
    });

    // One review pass out of "Final Video Check" by the reviewer.
    await db.taskStatusChange.create({
      data: {
        taskId: task.id, memberId: reviewer.id, action: "status_change",
        fromStatusId: review.id, fromStatusName: review.name,
        toStatusId: completed.id, toStatusName: completed.name,
      },
    });

    // ── 1. Live computation (task in progress, nothing locked) ────────────
    console.log("\n[1] Live computation on in-progress task");
    let effort = (await computeTaskEffort(task.id))!;
    const row = (label: string) => effort.rows.find((r) => r.label === label)!;

    check("words quantity = 264", approx(row("Transcript").quantity, 264));
    check("words minutes = 264 × 100", approx(row("Transcript").minutes, 26400));
    check("audio quantity = 2.46 min", approx(row("Voice Over").quantity, 2.46));
    check("audio minutes = 2.46 × 1", approx(row("Voice Over").minutes, 2.46));
    check("multi video sums known durations (2.46 min)", approx(row("Raw Footage").quantity, 2.46));
    check("multi video flags unknown duration", row("Raw Footage").flags.includes("unknown_duration"));
    check("fixed pending (not completed)", row("Poster").basis === "pending");
    check("no row locked", effort.rows.every((r) => !r.locked));
    check("review pass charged 15m to reviewer",
      effort.rows.some((r) => r.kind === "stage" && approx(r.minutes, 15) && r.memberId === reviewer.id));
    check("people grouping has doer", effort.people.some((p) => p.memberId === doer.id));

    // Rate change reflects immediately while in progress.
    await db.titleFieldRate.update({
      where: { titleId_templateItemId: { titleId: title.id, templateItemId: audioItem.id } },
      data: { minutesPerUnit: 2 },
    });
    effort = (await computeTaskEffort(task.id))!;
    check("live rate change applies instantly (2.46 × 2)", approx(row("Voice Over").minutes, 4.92));

    const lockedBefore = await db.taskChecklistItem.count({
      where: { taskId: task.id, effortLockedAt: { not: null } },
    });
    check("nothing written to effortLockedAt while in progress", lockedBefore === 0);

    // ── 2. Task completion locks snapshots ─────────────────────────────────
    console.log("\n[2] Completing the task locks effort");
    await db.task.update({
      where: { id: task.id },
      data: { statusId: completed.id, completedAt: new Date() },
    });
    await lockTaskEffortLocks(task.id);

    const lockedRows = await db.taskChecklistItem.findMany({
      where: { taskId: task.id, effortLockedAt: { not: null } },
      select: { id: true, effortQuantity: true, effortRate: true, effortMinutes: true },
    });
    check("3 completed effort fields locked (poster incomplete)", lockedRows.length === 3, lockedRows.length);
    const audioLock = lockedRows.find((r) => r.id === audioCi.id);
    check("audio lock captured current rate (2)", approx(audioLock?.effortRate, 2));
    check("audio lock minutes = 4.92", approx(audioLock?.effortMinutes, 4.92));

    // Rate change must NOT move locked numbers.
    await db.titleFieldRate.update({
      where: { titleId_templateItemId: { titleId: title.id, templateItemId: audioItem.id } },
      data: { minutesPerUnit: 5 },
    });
    effort = (await computeTaskEffort(task.id))!;
    check("locked row ignores new rate (still 4.92)", approx(row("Voice Over").minutes, 4.92));
    check("locked row reports locked=true", row("Voice Over").locked);

    // ── 3. Explicit task recalculate applies new rates ─────────────────────
    console.log("\n[3] Recalculate task effort");
    await recalculateTaskEffortLocks(task.id);
    effort = (await computeTaskEffort(task.id))!;
    check("recalc applies new rate (2.46 × 5 = 12.3)", approx(row("Voice Over").minutes, 12.3));

    // ── 4. Title-level recalc touches ONLY already-locked completed work ────
    console.log("\n[4] Title recalculate scope");
    const task2 = await db.task.create({
      data: { projectId: project.id, title: "QA In-Progress Task", statusId: todo.id, assigneeId: doer.id },
    });
    await db.taskChecklistItem.create({
      data: {
        taskId: task2.id, templateItemId: audioItem.id, name: audioItem.name,
        type: audioItem.type, effortUnit: "audio_min",
        attachmentId: audioAtt.id, completed: true, completedAt: now, completedBy: doer.id,
      },
    });

    await db.titleFieldRate.update({
      where: { titleId_templateItemId: { titleId: title.id, templateItemId: audioItem.id } },
      data: { minutesPerUnit: 7 },
    });
    const res = await recalculateTitleEffortLocks(title.id, ws.id);
    check("title recalc touched exactly the 3 locked fields", res.fieldCount === 3, res);
    check("title recalc touched exactly 1 task", res.taskCount === 1, res);

    const task2Locks = await db.taskChecklistItem.count({
      where: { taskId: task2.id, effortLockedAt: { not: null } },
    });
    check("in-progress task stays unlocked after title recalc", task2Locks === 0);

    effort = (await computeTaskEffort(task.id))!;
    check("completed task now costed at rate 7 (2.46 × 7 = 17.22)", approx(row("Voice Over").minutes, 17.22));

    // ── 5. Moving out of Completed clears locks ────────────────────────────
    console.log("\n[5] Reopening clears locks");
    await db.task.update({ where: { id: task.id }, data: { statusId: review.id, completedAt: null } });
    await clearTaskEffortLocks(task.id);
    const remaining = await db.taskChecklistItem.count({
      where: { taskId: task.id, effortLockedAt: { not: null } },
    });
    check("all locks cleared", remaining === 0);
    effort = (await computeTaskEffort(task.id))!;
    check("back to live computation (rate 7 live)", approx(row("Voice Over").minutes, 17.22));
    check("rows no longer locked", effort.rows.every((r) => !r.locked));

    // ── 6. Unknown single-file duration flag ───────────────────────────────
    console.log("\n[6] Unknown duration flag");
    await db.attachment.update({ where: { id: audioAtt.id }, data: { durationSec: null } });
    effort = (await computeTaskEffort(task.id))!;
    check("single file without duration flags unknown_duration",
      row("Voice Over").flags.includes("unknown_duration"));
    check("its quantity is null", row("Voice Over").quantity == null);

    // ── 7. Duplicate materialisation guard ─────────────────────────────────
    console.log("\n[7] Unique (taskId, templateItemId) guard");
    let dupBlocked = false;
    try {
      await db.taskChecklistItem.create({
        data: {
          taskId: task.id, templateItemId: wordsItem.id,
          name: "dup", type: "textarea",
        },
      });
    } catch {
      dupBlocked = true;
    }
    check("second row for same template field is rejected", dupBlocked);
    const skipRes = await db.taskChecklistItem.createMany({
      data: [{
        taskId: task.id, templateItemId: wordsItem.id,
        name: "dup", type: "textarea",
      }],
      skipDuplicates: true,
    });
    check("createMany skipDuplicates is a clean no-op", skipRes.count === 0);
  } finally {
    await db.workspace.delete({ where: { id: ws.id } });
    console.log("\nCleanup: QA workspace deleted.");
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll effort QA checks passed.");
}

main().finally(() => db.$disconnect());

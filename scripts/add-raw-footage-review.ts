// One-time pipeline change:
//   AI Generation    → Raw Footage            (rename)
//   (new)            → Raw Footage Review     (inserted after Raw Footage)
//   Internal Review  → Final Video Check      (rename)
// Every role's stage permissions for the new stage are copied from the
// Final Video Check stage (both are review stages), so teams can move tasks
// through it immediately and admins can adjust later in Settings → Roles.
//
//   npx tsx --env-file=.env scripts/add-raw-footage-review.ts
import { db } from "../src/lib/db";

const NEW_STAGE_NAME = "Raw Footage Review";

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } });

  for (const ws of workspaces) {
    const stages = await db.taskStatus.findMany({
      where: { workspaceId: ws.id },
      orderBy: { order: "asc" },
    });

    const aiGen = stages.find((s) => s.name === "AI Generation");
    if (aiGen) {
      await db.taskStatus.update({
        where: { id: aiGen.id },
        data: { name: "Raw Footage" },
      });
      console.log(`[${ws.id}] Renamed "AI Generation" → "Raw Footage"`);
    }

    const internalReview = stages.find((s) => s.name === "Internal Review");
    if (internalReview) {
      await db.taskStatus.update({
        where: { id: internalReview.id },
        data: { name: "Final Video Check" },
      });
      console.log(`[${ws.id}] Renamed "Internal Review" → "Final Video Check"`);
    }

    if (stages.some((s) => s.name === NEW_STAGE_NAME)) {
      console.log(`[${ws.id}] "${NEW_STAGE_NAME}" already exists, skipped.`);
      continue;
    }
    const rawFootage =
      aiGen ?? stages.find((s) => s.name === "Raw Footage");
    if (!rawFootage) {
      console.log(`[${ws.id}] No Raw Footage stage found, skipped insert.`);
      continue;
    }

    // Shift later stages down one slot (descending, to be safe), then insert.
    const later = stages
      .filter((s) => s.order > rawFootage.order)
      .sort((a, b) => b.order - a.order);
    for (const s of later) {
      await db.taskStatus.update({
        where: { id: s.id },
        data: { order: s.order + 1 },
      });
    }
    const created = await db.taskStatus.create({
      data: {
        workspaceId: ws.id,
        name: NEW_STAGE_NAME,
        order: rawFootage.order + 1,
        color: "#f59e0b",
      },
    });
    console.log(
      `[${ws.id}] Inserted "${NEW_STAGE_NAME}" at order ${created.order}`,
    );

    // Give every role the same stage permissions on the new stage as it has
    // on Final Video Check (the other review stage).
    if (internalReview) {
      const roles = await db.role.findMany({
        where: { workspaceId: ws.id },
        select: { id: true, name: true, permissions: true },
      });
      for (const role of roles) {
        const perms = (role.permissions ?? {}) as {
          taskPermissions?: { stages?: Record<string, unknown> };
        };
        const source = perms.taskPermissions?.stages?.[internalReview.id];
        if (!source) continue;
        perms.taskPermissions!.stages![created.id] = source;
        await db.role.update({
          where: { id: role.id },
          data: { permissions: perms as object },
        });
        console.log(
          `[${ws.id}]   Role "${role.name}": copied review-stage permissions to the new stage`,
        );
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// One-time production role-config fix (run with the prod DATABASE_URL):
//
//   1. "Creatives" and "Story Creator": Projects module full → view (their
//      full access bypassed every stage checkbox), and the project-settings /
//      assign-members capabilities off.
//   2. "Creatives Manger": Auto-Assign ON for the review stages they own —
//      "Raw Footage Review" and "Final Video Check".
//   3. "Project Owner": Auto-Assign OFF everywhere except "Review" (the stage
//      they personally handle) — stray auto-assigns were hijacking ownership
//      on every forward move.
//
// Dry-run by default; pass --apply to write.
//
//   DATABASE_URL=<prod> npx tsx scripts/fix-prod-roles.ts [--apply]
import { db } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

type StageFlags = {
  create?: boolean;
  modify?: boolean;
  forward?: boolean;
  rollback?: boolean;
  delete?: boolean;
  autoAssign?: boolean;
};
type Perms = Record<string, unknown> & {
  taskPermissions?: { stages: Record<string, StageFlags> };
  caps?: Record<string, Record<string, boolean>>;
};

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "dry-run"}\n`);
  // The database may hold several workspaces — roles and stages must never be
  // matched across workspace boundaries.
  const workspaces = await db.workspace.findMany({ select: { id: true, name: true } });
  for (const ws of workspaces) {
    console.log(`\n=== Workspace: ${ws.name} ===`);
    await fixWorkspace(ws.id);
  }
  if (!APPLY) console.log("\nDry-run only — re-run with --apply to save.");
}

async function fixWorkspace(workspaceId: string) {
  const [roles, stages] = await Promise.all([
    db.role.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    db.taskStatus.findMany({ where: { workspaceId }, orderBy: { order: "asc" } }),
  ]);
  const stageByName = new Map(stages.map((s) => [s.name, s]));
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));

  console.log("Stages:", stages.map((s) => s.name).join(" → "), "\n");

  const summary = (p: Perms) => {
    const auto = Object.entries(p.taskPermissions?.stages ?? {})
      .filter(([, f]) => f.autoAssign === true)
      .map(([id]) => stageNameById.get(id) ?? id);
    return `projects=${String(p.projects)} autoAssign=[${auto.join(", ")}]`;
  };

  for (const role of roles) {
    const perms = (role.permissions ?? {}) as Perms;
    const before = summary(perms);
    let changed = false;

    // ── 1. Full → View for the worker roles ─────────────────────────────────
    if (["Creatives", "Story Creator"].includes(role.name)) {
      if (perms.projects === "full" || perms.projects === "edit") {
        perms.projects = "view";
        perms.caps = {
          ...(perms.caps ?? {}),
          projects: {
            ...(perms.caps?.projects ?? {}),
            editSettings: false,
            assignMembers: false,
          },
        };
        changed = true;
      }
    }

    // ── 2. Reviewer auto-assign on the review stages ───────────────────────
    const normalized = role.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (["creatives manger", "creatives manager"].includes(normalized)) {
      for (const stageName of ["Raw Footage Review", "Final Video Check"]) {
        const stage = stageByName.get(stageName);
        if (!stage) {
          console.warn(`  !! stage "${stageName}" not found — skipped`);
          continue;
        }
        const tp = (perms.taskPermissions ??= { stages: {} });
        const flags = (tp.stages[stage.id] ??= {});
        if (flags.autoAssign !== true) {
          flags.autoAssign = true;
          changed = true;
        }
      }
    }

    // ── 3. Project Owner: auto-assign ONLY at "Review" ─────────────────────
    if (role.name === "Project Owner") {
      const keep = new Set(
        ["Review", "Published"]
          .map((n) => stageByName.get(n)?.id)
          .filter((id): id is string => !!id),
      );
      for (const [stageId, flags] of Object.entries(
        perms.taskPermissions?.stages ?? {},
      )) {
        if (flags.autoAssign === true && !keep.has(stageId)) {
          flags.autoAssign = false;
          changed = true;
        }
      }
    }

    if (!changed) {
      console.log(`- ${role.name}: unchanged (${before})`);
      continue;
    }
    console.log(`- ${role.name}:`);
    console.log(`    before  ${before}`);
    console.log(`    after   ${summary(perms)}`);
    if (APPLY) {
      await db.role.update({
        where: { id: role.id },
        data: { permissions: perms as import("../src/generated/prisma/client").Prisma.InputJsonValue },
      });
      console.log("    saved");
    }
  }

  if (!APPLY) console.log("\nDry-run only — re-run with --apply to save.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

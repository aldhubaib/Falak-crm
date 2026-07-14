// Stage-gate audit (READ-ONLY). For every live task, recomputes each
// checklist field's visibility / lock / gate state at the task's current
// stage using the exact library rules the server enforces
// (fieldConfig → isFieldVisible / isFieldLocked / isGateComplete), and
// reports any task whose stored data disagrees with those rules:
//
//   [GATE]      task sits past a field's "Required Before" stage but the
//               field isn't complete (a historical multi-stage-drag bypass)
//   [DELIVERY]  task is at/past the delivery-gate stage with a mandatory
//               delivery field still incomplete
//   [INVISIBLE] a field that hasn't reached its "Visible From" stage already
//               has an answer (was written while it shouldn't render)
//   [STALE]     a field rule or role flag references a stage id that no
//               longer exists (rule silently ignored)
//   [NOOP]      a role grants Forward on the last stage or Rollback on the
//               first one (flag can never apply)
//
// Also prints each role's per-stage flag matrix so the configuration can be
// eyeballed against the intended enforcement model.
//
//   npx tsx --env-file=.env scripts/qa-stage-gates.ts
//
// Point DATABASE_URL at production (e.g. --env-file=.env.production) to audit
// the live data. The script only ever reads.
import { db } from "../src/lib/db";
import {
  autoLockOrder,
  fieldAppliesForGate,
  fieldConfig,
  isDeliveryGateStage,
  isFieldLocked,
  isFieldVisible,
  isGateComplete,
} from "../src/lib/checklist-config";

type StageFlags = {
  create?: boolean;
  modify?: boolean;
  forward?: boolean;
  rollback?: boolean;
  delete?: boolean;
  autoAssign?: boolean;
};

type RolePerms = {
  projects?: string;
  taskPermissions?: { stages?: Record<string, StageFlags> };
};

let issues = 0;

function report(tag: string, msg: string) {
  issues++;
  console.log(`  [${tag}] ${msg}`);
}

async function auditWorkspace(ws: { id: string; name: string }) {
  console.log(`\n═══ Workspace: ${ws.name} ═══`);

  const statuses = await db.taskStatus.findMany({
    where: { workspaceId: ws.id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true },
  });
  const orderById = new Map(statuses.map((s) => [s.id, s.order]));
  const nameById = new Map(statuses.map((s) => [s.id, s.name]));
  const todoOrder = autoLockOrder(statuses);
  const firstStage = statuses[0];
  const lastStage = statuses[statuses.length - 1];
  const deliveryGate = statuses.find((s) => isDeliveryGateStage(s.name));

  // ── Role flag matrix + sanity ─────────────────────────────────────────────
  const roles = await db.role.findMany({
    where: { workspaceId: ws.id },
    select: { name: true, permissions: true },
  });
  console.log(`\nRole flags (${roles.length} roles, stages: ${statuses.map((s) => s.name).join(" → ")})`);
  for (const role of roles) {
    const perms = (role.permissions ?? {}) as RolePerms;
    const stages = perms.taskPermissions?.stages ?? {};
    const cells = statuses.map((s) => {
      const f = stages[s.id] ?? {};
      const letters = [
        f.create && "C",
        f.modify && "M",
        f.forward && "F",
        f.rollback && "R",
        f.delete && "D",
        f.autoAssign && "A",
      ].filter(Boolean);
      return `${s.name}:${letters.length ? letters.join("") : "-"}`;
    });
    console.log(`  ${role.name}${perms.projects === "full" ? " (FULL)" : ""}  ${cells.join("  ")}`);

    for (const [stageId, flags] of Object.entries(stages)) {
      if (!orderById.has(stageId)) {
        const any = Object.values(flags).some(Boolean);
        if (any) report("STALE", `role "${role.name}" has flags on unknown stage ${stageId}`);
        continue;
      }
      if (flags.forward && lastStage && stageId === lastStage.id) {
        report("NOOP", `role "${role.name}" grants Forward on the last stage (${lastStage.name})`);
      }
      if (flags.rollback && firstStage && stageId === firstStage.id) {
        report("NOOP", `role "${role.name}" grants Rollback on the first stage (${firstStage.name})`);
      }
    }
  }

  // ── Template field rules sanity ───────────────────────────────────────────
  const templateItems = await db.checklistTemplateItem.findMany({
    where: { template: { workspaceId: ws.id }, hidden: false },
    select: {
      name: true,
      visibleFromStageId: true,
      requiredBeforeStageId: true,
      lockedFromStageId: true,
      template: { select: { name: true } },
    },
  });
  for (const ti of templateItems) {
    for (const [rule, stageId] of [
      ["Visible From", ti.visibleFromStageId],
      ["Required Before", ti.requiredBeforeStageId],
      ["Locked From", ti.lockedFromStageId],
    ] as const) {
      if (stageId && !orderById.has(stageId)) {
        report("STALE", `"${ti.template.name}" field "${ti.name}": ${rule} points at a deleted stage — rule is ignored`);
      }
    }
  }

  // ── Per-task recomputation ────────────────────────────────────────────────
  const tasks = await db.task.findMany({
    where: { project: { workspaceId: ws.id, deletedAt: null }, deletedAt: null },
    select: {
      taskNumber: true,
      title: true,
      statusId: true,
      status: { select: { name: true, order: true } },
      project: { select: { name: true } },
      checklistItems: {
        select: {
          name: true,
          type: true,
          phase: true,
          role: true,
          mandatory: true,
          completed: true,
          hidden: true,
          textValue: true,
          attachmentId: true,
          visibleFromStageId: true,
          requiredBeforeStageId: true,
          lockedFromStageId: true,
          neverLock: true,
          templateItem: true,
        },
      },
    },
  });

  console.log(`\nTasks audited: ${tasks.length}`);
  for (const task of tasks) {
    const currentOrder = task.status?.order ?? null;
    const label = `${task.project.name} T-${task.taskNumber} "${task.title}" @ ${task.status?.name ?? "no stage"}`;

    for (const ci of task.checklistItems) {
      const cfg = fieldConfig(ci);
      if (cfg.hidden) continue;

      const visible = isFieldVisible(cfg, currentOrder, orderById);
      const hasAnswer =
        ci.completed || !!(ci.textValue ?? "").trim() || !!ci.attachmentId;

      // Answered while not yet visible — written through a hole that the
      // write guard now closes.
      if (!visible && hasAnswer) {
        report("INVISIBLE", `${label}: "${cfg.name}" has an answer but only becomes visible at ${nameById.get(cfg.visibleFromStageId ?? "") ?? "a later stage"}`);
      }
      if (!visible) continue;
      if (!fieldAppliesForGate(ci, task.checklistItems)) continue;

      // Required Before: the task should never sit past the gate with the
      // field incomplete.
      const gateOrder = cfg.requiredBeforeStageId
        ? orderById.get(cfg.requiredBeforeStageId)
        : undefined;
      if (
        gateOrder != null &&
        currentOrder != null &&
        currentOrder >= gateOrder &&
        !isGateComplete(ci, cfg)
      ) {
        report("GATE", `${label}: "${cfg.name}" is required before ${nameById.get(cfg.requiredBeforeStageId!)} but incomplete`);
      }

      // Delivery gate: at/past the gate stage every mandatory delivery field
      // must be complete.
      if (
        deliveryGate &&
        currentOrder != null &&
        currentOrder >= deliveryGate.order &&
        cfg.phase === "delivery" &&
        cfg.mandatory &&
        !isGateComplete(ci, cfg)
      ) {
        report("DELIVERY", `${label}: mandatory delivery field "${cfg.name}" incomplete at/past ${deliveryGate.name}`);
      }

      // Lock rule is recomputed here purely to surface crashes/stale ids —
      // a locked field with an answer is fine (it was filled before locking).
      void isFieldLocked(
        {
          phase: cfg.phase,
          lockedFromStageId: cfg.lockedFromStageId,
          neverLock: cfg.neverLock,
        },
        currentOrder,
        orderById,
        todoOrder,
      );
    }
  }
}

async function main() {
  const workspaces = await db.workspace.findMany({
    select: { id: true, name: true },
  });
  for (const ws of workspaces) {
    await auditWorkspace(ws);
  }

  if (issues > 0) {
    console.log(`\n${issues} finding(s) — see tags above. GATE/DELIVERY/INVISIBLE entries are historical bypasses (data written before the fixes); STALE/NOOP are configuration cleanups.`);
  } else {
    console.log("\nNo disagreements: every task's stored state matches the stage rules.");
  }
}

main().finally(() => db.$disconnect());

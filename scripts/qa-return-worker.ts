// QA for the forward-return assignment rule ("reviewers borrow, workers own"):
// pickReturnWorker decides who a task goes back to when it moves forward out
// of a review stage. Pure function — no database needed.
//
//   npx tsx scripts/qa-return-worker.ts
import { pickReturnWorker, type StageRef, type ReturnCandidateMember } from "../src/lib/assignment";

let failures = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

// Board mirroring production: work stages interleaved with review stages.
const STAGES: StageRef[] = [
  { id: "backlog", name: "Backlog", order: 0 },
  { id: "todo", name: "Todo", order: 1 },
  { id: "raw", name: "Raw Footage", order: 2 },
  { id: "rawreview", name: "Raw Footage Review", order: 3 },
  { id: "post", name: "Post Production", order: 4 },
  { id: "fvc", name: "Final Video Check", order: 5 },
  { id: "review", name: "Review", order: 6 },
  { id: "done", name: "Completed", order: 7 },
];

const forwardAt = (...stageIds: string[]) => ({
  projects: "view",
  taskPermissions: {
    stages: Object.fromEntries(
      stageIds.map((id) => [
        id,
        { create: false, modify: true, forward: true, rollback: false, delete: false, autoAssign: false },
      ]),
    ),
  },
});

const MEMBERS: ReturnCandidateMember[] = [
  // Worker who may move forward from Post Production and Raw Footage.
  { memberId: "ahmed", memberType: "MEMBER", rolePermissions: forwardAt("raw", "post", "todo") },
  // Second worker (earlier loop owner of Post Production).
  { memberId: "sara", memberType: "MEMBER", rolePermissions: forwardAt("post") },
  // Reviewer.
  { memberId: "manager", memberType: "MEMBER", rolePermissions: forwardAt("rawreview", "fvc") },
  // Full Projects access — qualifies everywhere.
  { memberId: "fullaccess", memberType: "MEMBER", rolePermissions: { projects: "full" } },
  // Workspace owner on the project with no role — bypasses checks.
  { memberId: "boss", memberType: "OWNER", rolePermissions: null },
  // On the project but no forward rights anywhere.
  { memberId: "norights", memberType: "MEMBER", rolePermissions: { projects: "view" } },
];

function run(
  history: Record<string, string>,
  fromStatusId: string,
  targetStatusId: string,
  projectMembers: ReturnCandidateMember[] = MEMBERS,
) {
  return pickReturnWorker({ history, statuses: STAGES, fromStatusId, targetStatusId, projectMembers });
}

console.log("\n[1] Basic return: approval hands the task back to the worker");
check(
  "Raw Footage Review → Post Production returns to the Raw Footage owner",
  run({ todo: "ahmed", raw: "ahmed", rawreview: "manager" }, "rawreview", "post") === "ahmed",
);
check(
  "most advanced non-review stage wins over earlier ones",
  run({ todo: "sara", raw: "ahmed", rawreview: "manager" }, "rawreview", "post") === "ahmed",
);

console.log("\n[2] Review-stage owners are never return targets");
check(
  "history holding only reviewer entries returns nobody",
  run({ rawreview: "manager", fvc: "manager" }, "fvc", "review") === null,
);
check(
  "reviewer entry is skipped even when it is the most recent",
  run({ raw: "ahmed", rawreview: "manager" }, "rawreview", "post") === "ahmed",
);

console.log("\n[3] Target-stage history takes priority (rejection loops)");
check(
  "returning to a stage someone owned before gives it back to them",
  run({ raw: "ahmed", post: "sara", rawreview: "manager" }, "rawreview", "post") === "sara",
);
check(
  "target-stage priority skipped when that owner is no longer eligible",
  run({ raw: "ahmed", post: "ghost", rawreview: "manager" }, "rawreview", "post") === "ahmed",
);

console.log("\n[4] Safety checks on the candidate");
check(
  "worker who left the project is skipped (falls back to null → mover)",
  run({ raw: "ghost", rawreview: "manager" }, "rawreview", "post") === null,
);
check(
  "worker without Forward at the target stage is skipped",
  run({ raw: "norights", rawreview: "manager" }, "rawreview", "post") === null,
);
check(
  "ineligible best candidate falls through to the next eligible worker",
  run({ todo: "ahmed", raw: "norights", rawreview: "manager" }, "rawreview", "post") === "ahmed",
);
check(
  "full Projects access qualifies without stage flags",
  run({ raw: "fullaccess", rawreview: "manager" }, "rawreview", "post") === "fullaccess",
);
check(
  "workspace owner qualifies without any role",
  run({ raw: "boss", rawreview: "manager" }, "rawreview", "post") === "boss",
);

console.log("\n[5] Edge cases");
check("empty history returns nobody", run({}, "rawreview", "post") === null);
check(
  "stages at/after the review stage are ignored for the last-worker scan",
  run({ post: "sara", fvc: "manager" }, "rawreview", "raw") === null,
);
check(
  "unknown stage ids in history are ignored",
  run({ deletedstage: "ahmed", rawreview: "manager" }, "rawreview", "post") === null,
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

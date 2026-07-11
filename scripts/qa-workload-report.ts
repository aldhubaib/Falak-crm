// Read-only smoke test for the Workload Report: runs the report over the last
// 14 days for the first workspace and prints the grouped result. Touches
// nothing — safe on any database.
//
//   npx tsx --env-file=.env scripts/qa-workload-report.ts
import { db } from "../src/lib/db";
import { computeWorkloadReport } from "../src/lib/workload-report";

async function main() {
  const workspace = await db.workspace.findFirst({ select: { id: true, name: true } });
  if (!workspace) {
    console.log("No workspace found.");
    return;
  }

  const to = new Date();
  const from = new Date(to.getTime() - 13 * 86_400_000);
  const report = await computeWorkloadReport(workspace.id, from, to);

  console.log(`Workspace: ${workspace.name}`);
  console.log(`Range: ${from.toISOString()} → ${to.toISOString()}`);
  console.log(`People: ${report.people.length}, total ${Math.round(report.totalMinutes)}m, flags: ${report.hasFlags}`);
  for (const p of report.people) {
    const pct =
      p.capacityMinutes && p.capacityMinutes > 0
        ? ` (${Math.round((p.minutes / p.capacityMinutes) * 100)}% of range)`
        : "";
    console.log(`\n${p.name} [${p.titleName ?? "no title"}] — ${p.taskCount} tasks, ${Math.round(p.minutes)}m${pct}`);
    for (const r of p.rows) {
      console.log(
        `  ${r.date.slice(0, 10)}  ${r.kind === "review" ? "review" : "field "} ${r.taskTitle} · ${r.label} · ${r.quantity ?? "—"} ${r.unit} × ${r.rate ?? "—"} = ${r.minutes != null ? Math.round(r.minutes * 100) / 100 : "—"}m${r.locked ? " [locked]" : ""}${r.flags.length ? ` flags:${r.flags.join(",")}` : ""}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { computeWorkloadReport } from "@/lib/workload-report";
import { WorkloadClient } from "./workload-client";

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function WorkloadReportPage() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (member.type !== "OWNER") redirect("/settings");

  // Default window: the last two weeks, ending today.
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 86_400_000);
  const fromStr = toDateInput(from);
  const toStr = toDateInput(to);

  const initialReport = await computeWorkloadReport(
    workspace.id,
    new Date(`${fromStr}T00:00:00.000`),
    new Date(`${toStr}T23:59:59.999`),
  );

  return (
    <>
      <AppHeader title="Workload Report" backHref="/settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <WorkloadClient
          initialFrom={fromStr}
          initialTo={toStr}
          initialReport={initialReport}
        />
      </main>
    </>
  );
}

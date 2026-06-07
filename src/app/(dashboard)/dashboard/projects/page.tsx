import { getDealsInDelivery } from "@/actions/deals";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const deals = await getDealsInDelivery();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No active projects. Win a deal and start a project to see it here.
        </div>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => {
            const project = deal.project!;
            const totalTasks = project.tasks.length;
            const completedTasks = project.tasks.filter((t) => t.completedAt).length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <Link
                key={deal.id}
                href={`/dashboard/deals/${deal.id}?tab=project`}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors no-underline block"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-purple/15 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4 h-4 text-purple" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-medium text-foreground truncate">
                      {deal.title}
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {deal.company?.name || "No company"} •{" "}
                      {project._count.tasks} tasks • {project._count.invoices} invoices
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {totalTasks > 0 && (
                    <div className="w-24">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
                        {progress}%
                      </p>
                    </div>
                  )}
                  {project.status && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        backgroundColor: `${project.status.color}20`,
                        color: project.status.color,
                      }}
                    >
                      {project.status.name}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { getProjects } from "@/actions/projects";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No projects yet. Win a deal to create your first project.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors no-underline block"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple/15 flex items-center justify-center">
                  <FolderKanban className="w-4 h-4 text-purple" />
                </div>
                <div>
                  <h3 className="text-[13px] font-medium text-foreground">
                    {project.name}
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {project.company?.name || "No company"} •{" "}
                    {project._count.tasks} tasks • {project._count.invoices} invoices
                  </p>
                </div>
              </div>
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

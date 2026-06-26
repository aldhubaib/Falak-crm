import { getProjects } from "@/actions/projects";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectCardThumbnail } from "./project-list-thumbnail";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="p-6">
      <div className="flex items-center justify-end mb-4">
        <Link
          href="/projects/new"
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium flex items-center gap-1.5 no-underline hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No projects yet. Create a project to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors no-underline group"
            >
              <div className="aspect-square w-full overflow-hidden bg-card">
                <ProjectCardThumbnail
                  thumbnailId={project.thumbnailId}
                  name={project.name}
                />
              </div>
              <div className="p-3">
                <h3 className="text-[13px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{project.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                  {project._count.tasks} tasks • {project._count.invoices} invoices
                </p>
                {project.status && (
                  <span
                    className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
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
          ))}
        </div>
      )}
    </div>
  );
}

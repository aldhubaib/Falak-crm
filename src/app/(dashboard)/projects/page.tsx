import Link from "next/link";
import { Plus, Users, ListTodo } from "lucide-react";
import { getProjects } from "@/actions/projects";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

function hueFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <>
      <AppHeader
        title="Projects"
        actions={
          <Button asChild size="icon" className="rounded-full" aria-label="New Project">
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((p) => {
            const hue = hueFor(p.id);
            const statusDot =
              p.status?.name === "Active"
                ? "bg-emerald-400"
                : p.status?.name === "On Hold"
                  ? "bg-amber-400"
                  : p.status?.name === "Completed"
                    ? "bg-primary"
                    : "bg-muted-foreground";
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border"
                style={
                  {
                    ["--accent" as string]: `oklch(0.72 0.16 ${hue})`,
                  } as React.CSSProperties
                }
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                  style={{ background: "var(--accent)" }}
                />
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--accent), transparent)",
                  }}
                />

                <div className="relative flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ring-1 ring-white/10 shadow-sm"
                    style={{ background: `hsl(${hue} 70% 55%)` }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {p.name}
                      </div>
                      <span
                        className={`ml-auto inline-block size-1.5 shrink-0 rounded-full ${statusDot}`}
                        title={p.status?.name || "Unknown"}
                      />
                    </div>
                    {p.company && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.company.name}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-tiny text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ListTodo className="size-3" />
                        {p._count.tasks}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {projects.length === 0 && (
            <EmptyState
              className="col-span-full p-10"
              message="No projects yet. Create your first one."
              action={
                <Button asChild size="sm">
                  <Link href="/projects/new">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}

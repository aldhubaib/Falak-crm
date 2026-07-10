import Link from "next/link";
import { FolderKanban, ListTodo, FileText, CalendarDays } from "lucide-react";
import { getProjects } from "@/actions/projects";
import { getMyResponsibility } from "@/actions/responsibility";
import { AppHeader } from "@/components/app-header";
import { MyResponsibilityModule } from "@/components/dashboard/my-responsibility-module";

export default async function DashboardPage() {
  const [projects, responsibility] = await Promise.all([
    getProjects(),
    getMyResponsibility(),
  ]);

  const totalTasks = projects.reduce((n, p) => n + p._count.tasks, 0);
  const totalInvoices = projects.reduce((n, p) => n + p._count.invoices, 0);

  return (
    <>
      <AppHeader title="Dashboard" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-5 space-y-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={FolderKanban}
              label="Projects"
              value={projects.length}
              href="/projects"
            />
            <StatCard
              icon={ListTodo}
              label="Tasks"
              value={totalTasks}
            />
            <StatCard
              icon={FileText}
              label="Invoices"
              value={totalInvoices}
            />
            <StatCard
              icon={CalendarDays}
              label="Publish"
              value="Go"
              href="/publish"
            />
          </div>

          <MyResponsibilityModule data={responsibility} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-3 transition-colors hover:border-border"
                  >
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: `hsl(${(p.name.charCodeAt(0) * 31) % 360} 70% 55%)` }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                      {p.company && (
                        <div className="truncate text-xs text-muted-foreground">{p.company.name}</div>
                      )}
                    </div>
                    <span className="text-tiny text-muted-foreground">
                      {p._count.tasks} tasks
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  href?: string;
}) {
  const content = (
    <div className="rounded-card border border-border/60 bg-surface p-4 transition-colors hover:border-border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

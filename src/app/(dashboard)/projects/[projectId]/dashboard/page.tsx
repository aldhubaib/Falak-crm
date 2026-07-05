import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectDashboard } from "@/actions/projects";
import { getTaskStatuses } from "@/actions/settings";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/workspace";
import { hasCap } from "@/lib/permissions";
import { AppHeader } from "@/components/app-header";
import { ProjectViewMenu } from "@/components/projects/project-view-menu";
import { cn } from "@/lib/utils";

type TaskRow = NonNullable<
  Awaited<ReturnType<typeof getProjectDashboard>>
>["tasks"][number];

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, statuses, access] = await Promise.all([
    getProjectDashboard(projectId),
    getTaskStatuses(),
    getProjectAccess(projectId),
  ]);
  if (!project) notFound();

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: project.workspaceId },
    select: { id: true, name: true, email: true },
  });
  const memberName = new Map(
    members.map((m) => [m.id, m.name || m.email || "Unknown"]),
  );

  const tasks = project.tasks;
  const inProgress = statuses.find(
    (s) => s.name.trim().toLowerCase() === "in progress",
  );

  const stats = computeStats(tasks);
  const performance = computePerformance(tasks, inProgress?.id ?? null, memberName);
  const maxWork = performance[0]?.totalMs ?? 0;

  return (
    <>
      <AppHeader
        backHref="/projects"
        title={project.name}
        actions={
          <ProjectViewMenu
            projectId={projectId}
            showSettings={hasCap(access.permissions, "projects", "editSettings")}
          />
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 p-5">
          {/* KPI grid */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total tasks" value={stats.total} />
            <KpiCard label="In progress" value={stats.inProgress} tone="primary" />
            <KpiCard label="In review" value={stats.inReview} tone="warning" />
            <KpiCard
              label="Completion"
              value={`${stats.completionPct}%`}
              hint={`${stats.completed}/${stats.total || 0} done`}
              tone="success"
            />
          </section>

          {/* Team performance */}
          <section className="rounded-lg border border-border/60 bg-surface/40 p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Team performance</h2>
              <Link
                href={`/projects/${projectId}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View board
              </Link>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Work time = duration the task spent in{" "}
              <span className="text-primary">In Progress</span> under this
              assignee.
            </p>
            {performance.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No tracked work yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {performance.map((p) => (
                  <PerformanceRow key={p.key} row={p} maxWork={maxWork} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type PerfRow = {
  key: string;
  name: string;
  totalMs: number;
  taskCount: number;
  activeCount: number;
  activeMs: number;
  avgMs: number;
  rejections: number;
  rejectedTasks: number;
};

function computeStats(tasks: TaskRow[]) {
  const total = tasks.length;
  const inProgress = tasks.filter(
    (t) => (t.status?.name ?? "").trim().toLowerCase() === "in progress",
  ).length;
  const inReview = tasks.filter((t) =>
    (t.status?.name ?? "").toLowerCase().includes("review"),
  ).length;
  const completed = tasks.filter((t) => t.completedAt != null).length;
  const completionPct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, inProgress, inReview, completed, completionPct };
}

function computePerformance(
  tasks: TaskRow[],
  inProgressId: string | null,
  memberName: Map<string, string>,
): PerfRow[] {
  if (!inProgressId) return [];
  const now = Date.now();
  const map = new Map<string, PerfRow>();

  const rowFor = (key: string, name: string) => {
    const existing = map.get(key);
    if (existing) return existing;
    const created: PerfRow = {
      key,
      name,
      totalMs: 0,
      taskCount: 0,
      activeCount: 0,
      activeMs: 0,
      avgMs: 0,
      rejections: 0,
      rejectedTasks: 0,
    };
    map.set(key, created);
    return created;
  };

  for (const t of tasks) {
    const timings = (t.stageTimings as Record<string, number> | null) ?? {};
    const history =
      (t.assignmentHistory as Record<string, string> | null) ?? {};

    let workedMs = timings[inProgressId] ?? 0;
    let activeMs = 0;
    const isActive = t.statusId === inProgressId;

    if (isActive && t.stageEnteredAt) {
      activeMs = Math.max(0, now - new Date(t.stageEnteredAt).getTime());
      workedMs += activeMs;
    }

    // Who did the In Progress work: current assignee if active, else the
    // assignee recorded when the task moved out of In Progress.
    const workerId = isActive
      ? t.assigneeId
      : (history[inProgressId] ?? t.assigneeId);

    if (workedMs <= 0 && t.rejectionCount <= 0) continue;
    if (!workerId) continue;

    const name =
      (isActive ? t.assignee?.name : undefined) ??
      memberName.get(workerId) ??
      "Unknown";
    const row = rowFor(workerId, name);

    if (workedMs > 0) {
      row.totalMs += workedMs;
      row.taskCount += 1;
    }
    if (activeMs > 0) {
      row.activeCount += 1;
      row.activeMs += activeMs;
    }
    if (t.rejectionCount > 0) {
      row.rejections += t.rejectionCount;
      row.rejectedTasks += 1;
    }
  }

  const rows = [...map.values()];
  for (const r of rows) r.avgMs = r.taskCount > 0 ? r.totalMs / r.taskCount : 0;
  rows.sort((a, b) => b.totalMs - a.totalMs);
  return rows;
}

function PerformanceRow({ row, maxWork }: { row: PerfRow; maxWork: number }) {
  const pct = maxWork > 0 ? Math.round((row.totalMs / maxWork) * 100) : 0;
  return (
    <li className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-tiny font-semibold text-primary"
        >
          {initials(row.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{row.name}</span>
            {row.activeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-tiny text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Working now
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/70">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-center md:grid-cols-5">
        <PerfStat label="Total work" value={formatDuration(row.totalMs)} tone="primary" />
        <PerfStat label="Avg / task" value={formatDuration(row.avgMs)} />
        <PerfStat label="Tasks" value={String(row.taskCount)} />
        <PerfStat
          label="Rejected"
          value={String(row.rejections)}
          hint={
            row.rejectedTasks > 0
              ? `${row.rejectedTasks} task${row.rejectedTasks === 1 ? "" : "s"}`
              : undefined
          }
          tone={row.rejections > 0 ? "danger" : "default"}
        />
        <PerfStat
          label="Active now"
          value={row.activeCount > 0 ? formatDuration(row.activeMs) : "—"}
          tone={row.activeCount > 0 ? "warning" : "default"}
        />
      </dl>
    </li>
  );
}

function PerfStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-md bg-surface/40 px-2 py-2">
      <div className="text-tiny uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-tiny text-muted-foreground">{hint}</div>}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const days = hours / 24;
  const d = Math.floor(days);
  const h = Math.round((days - d) * 24);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

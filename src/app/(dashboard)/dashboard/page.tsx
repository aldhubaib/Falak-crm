import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { getRecentActivity } from "@/lib/activity";
import { ActivityFeed } from "@/components/activity-feed";
import Link from "next/link";

export default async function DashboardPage() {
  const workspace = await requireWorkspace();

  const [dealCount, projectCount, pendingInvoices, paidInvoices] = await Promise.all([
    db.deal.count({
      where: {
        workspaceId: workspace.id,
        stage: { type: "OPEN" },
      },
    }),
    db.project.count({
      where: { workspaceId: workspace.id },
    }),
    db.invoice.count({
      where: { workspaceId: workspace.id, status: { in: ["SENT", "ACCEPTED"] } },
    }),
    db.invoice.findMany({
      where: { workspaceId: workspace.id, status: "PAID" },
      select: { total: true },
    }),
  ]);

  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  const [recentDeals, recentActivity] = await Promise.all([
    db.deal.findMany({
      where: { workspaceId: workspace.id },
      include: { stage: true, company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getRecentActivity(15),
  ]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Active Deals" value={String(dealCount)} color="primary" href="/dashboard/deals" />
        <StatCard label="Projects" value={String(projectCount)} color="purple" href="/dashboard/projects" />
        <StatCard label="Pending Invoices" value={String(pendingInvoices)} color="orange" href="/dashboard/invoices" />
        <StatCard label="Revenue" value={`${totalRevenue.toLocaleString()} ${workspace.baseCurrency}`} color="success" href="/dashboard/invoices" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Deals */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-foreground">Recent Deals</h3>
          <Link href="/dashboard/deals" className="text-[11px] text-primary no-underline hover:text-primary/80">
            View all
          </Link>
        </div>
        {recentDeals.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No deals yet. Create your first deal to get started.</p>
        ) : (
          <div className="space-y-2">
            {recentDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/dashboard/deals/${deal.id}`}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors no-underline"
              >
                <div>
                  <p className="text-[13px] text-foreground">{deal.title}</p>
                  <p className="text-[11px] text-muted-foreground">{deal.company?.name || "No company"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-medium text-foreground">
                    {Number(deal.value).toLocaleString()} {workspace.baseCurrency}
                  </p>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${deal.stage.color}20`, color: deal.stage.color }}
                  >
                    {deal.stage.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[13px] font-medium text-foreground mb-4">Activity</h3>
        <ActivityFeed activities={recentActivity as any} />
      </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string;
  color: "primary" | "purple" | "orange" | "success";
  href: string;
}) {
  const colorClasses = {
    primary: "text-primary",
    purple: "text-purple",
    orange: "text-orange",
    success: "text-success",
  };

  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors no-underline block"
    >
      <p className="text-[12px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-semibold ${colorClasses[color]}`}>{value}</p>
    </Link>
  );
}

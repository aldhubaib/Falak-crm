export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Deals" value="12" color="primary" />
        <StatCard label="Open Projects" value="5" color="purple" />
        <StatCard label="Pending Invoices" value="3" color="orange" />
        <StatCard label="Total Revenue" value="125,000 SAR" color="success" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "primary" | "purple" | "orange" | "success";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    purple: "bg-purple/10 text-purple",
    orange: "bg-orange/10 text-orange",
    success: "bg-success/10 text-success",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[13px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colorClasses[color]}`}>
        {value}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between h-12 mb-6">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      <div className="space-y-4">
        <SettingsSection
          title="Pipelines & Stages"
          description="Configure deal pipeline stages and their order"
        />
        <SettingsSection
          title="Project Statuses"
          description="Define the statuses for your projects"
        />
        <SettingsSection
          title="Task Statuses"
          description="Configure task workflow statuses"
        />
        <SettingsSection
          title="Custom Fields"
          description="Add custom fields to companies, contacts, and deals"
        />
        <SettingsSection
          title="WhatsApp"
          description="Connect your WhatsApp Business account"
        />
        <SettingsSection
          title="Team & Roles"
          description="Manage team members, freelancers, and permissions"
        />
        <SettingsSection
          title="Billing"
          description="Currency, tax rates, and invoice numbering"
        />
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-border/80 transition-colors cursor-pointer">
      <div>
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
      <svg
        className="w-4 h-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 4.5l7.5 7.5-7.5 7.5"
        />
      </svg>
    </div>
  );
}

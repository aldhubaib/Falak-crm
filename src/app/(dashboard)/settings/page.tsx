import Link from "next/link";
import { GitBranch, Layers, ListChecks, ClipboardCheck, MessageCircle, Users, Receipt, Building2, UserPlus, Trash2, ArrowRightLeft } from "lucide-react";

const settingsItems = [
  {
    title: "Services",
    description: "Manage your service catalog and pricing",
    href: "/settings/services",
    icon: Layers,
  },
  {
    title: "Pipelines & Stages",
    description: "Configure deal pipeline stages and their order",
    href: "/settings/pipelines",
    icon: GitBranch,
  },
  {
    title: "Statuses",
    description: "Project and task statuses",
    href: "/settings/statuses",
    icon: ListChecks,
  },
  {
    title: "Checklists",
    description: "Task checklist templates with role-based items and stage gates",
    href: "/settings/checklists",
    icon: ClipboardCheck,
  },
  {
    title: "Industries",
    description: "Manage industry options for companies",
    href: "/settings/industries",
    icon: Building2,
  },
  {
    title: "Referrals",
    description: "Manage referral source options for companies",
    href: "/settings/referrals",
    icon: UserPlus,
  },
  {
    title: "Team & Roles",
    description: "Manage team members, freelancers, and permissions",
    href: "/settings/team",
    icon: Users,
  },
  {
    title: "Currencies",
    description: "Manage currencies and exchange rates",
    href: "/settings/currencies",
    icon: ArrowRightLeft,
  },
  {
    title: "Billing",
    description: "Tax rates and invoice numbering",
    href: "/settings/billing",
    icon: Receipt,
  },
  {
    title: "WhatsApp",
    description: "Connect your WhatsApp Business account",
    href: "/settings/whatsapp",
    icon: MessageCircle,
  },
  {
    title: "Trash",
    description: "View and restore deleted records",
    href: "/settings/trash",
    icon: Trash2,
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors no-underline block"
          >
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <item.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-medium text-foreground">{item.title}</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  GitBranch,
  Layers,
  ListChecks,
  ClipboardCheck,
  MessageCircle,
  Users,
  Receipt,
  Building2,
  UserPlus,
  Trash2,
  ArrowRightLeft,
  Settings,
  FolderKanban,
  Handshake,
  FileText,
  Plug,
} from "lucide-react";

type SettingsLink = {
  title: string;
  href: string;
};

type SettingsCategory = {
  name: string;
  icon: typeof Settings;
  color: string;
  links: SettingsLink[];
};

const generalSettings: SettingsCategory[] = [
  {
    name: "General",
    icon: Settings,
    color: "text-primary",
    links: [
      { title: "Team & Roles", href: "/settings/team" },
      { title: "Trash", href: "/settings/trash" },
    ],
  },
  {
    name: "CRM",
    icon: Handshake,
    color: "text-purple",
    links: [
      { title: "Pipelines & Stages", href: "/settings/pipelines" },
      { title: "Industries", href: "/settings/industries" },
      { title: "Referrals", href: "/settings/referrals" },
    ],
  },
  {
    name: "Projects",
    icon: FolderKanban,
    color: "text-success",
    links: [
      { title: "Statuses", href: "/settings/statuses" },
      { title: "Checklists", href: "/settings/checklists" },
    ],
  },
  {
    name: "Billing & Finance",
    icon: FileText,
    color: "text-orange",
    links: [
      { title: "Services", href: "/settings/services" },
      { title: "Currencies", href: "/settings/currencies" },
      { title: "Billing", href: "/settings/billing" },
    ],
  },
  {
    name: "Integrations",
    icon: Plug,
    color: "text-cyan",
    links: [
      { title: "WhatsApp", href: "/settings/whatsapp" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {generalSettings.map((category) => (
          <div
            key={category.name}
            className="rounded-xl border border-border bg-card p-4 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
              <category.icon
                className={`w-4 h-4 ${category.color}`}
                strokeWidth={1.5}
              />
              <h3 className={`text-[13px] font-semibold ${category.color}`}>
                {category.name}
              </h3>
            </div>
            <div className="space-y-0.5">
              {category.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors no-underline rounded-md hover:bg-muted/40"
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

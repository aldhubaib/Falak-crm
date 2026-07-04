import Link from "next/link";
import {
  ClipboardList,
  ChevronRight,
  Users,
  ShieldCheck,
  Trash2,
  GitBranch,
  Layers,
  Coins,
  Receipt,
  MessageCircle,
  LogIn,
  Image as ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";

export default function SettingsPage() {
  return (
    <>
      <AppHeader title="Settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer className="mx-auto max-w-2xl space-y-8 pb-10">
          <Group title="Projects">
            <Tile
              href="/settings/task-types"
              icon={ClipboardList}
              title="Task Types"
              desc="Define reusable checklists with Requirements and Delivery fields."
            />
          </Group>

          <Group title="CRM">
            <Tile
              href="/settings/pipelines"
              icon={GitBranch}
              title="Pipelines & Stages"
              desc="Configure sales pipelines and their stages."
            />
          </Group>

          <Group title="Team & Roles">
            <Tile
              href="/settings/team"
              icon={Users}
              title="Team"
              desc="Invite people to the system and manage members."
            />
            <Tile
              href="/settings/roles"
              icon={ShieldCheck}
              title="Roles"
              desc="Define roles and permissions across the system."
            />
          </Group>

          <Group title="Finance">
            <Tile
              href="/settings/services"
              icon={Layers}
              title="Services"
              desc="Manage the services you offer and their pricing."
            />
            <Tile
              href="/settings/currencies"
              icon={Coins}
              title="Currencies"
              desc="Configure supported currencies and exchange rates."
            />
            <Tile
              href="/settings/billing"
              icon={Receipt}
              title="Billing"
              desc="Manage invoices, payments, and billing details."
            />
          </Group>

          <Group title="General">
            <Tile
              href="/settings/trash"
              icon={Trash2}
              title="Trash"
              desc="Restore deleted items or empty the trash."
            />
          </Group>

          <Group title="Appearance">
            <Tile
              href="/settings/app-logo"
              icon={ImageIcon}
              title="App Logo"
              desc="Upload favicon, PWA icons, web logo, and social share image."
            />
            <Tile
              href="/settings/login"
              icon={LogIn}
              title="Login Page"
              desc="Add photos shown on the sign-in page's scrolling gallery."
            />
          </Group>

          <Group title="Integrations">
            <Tile
              href="/settings/integrations/whatsapp"
              icon={MessageCircle}
              title="WhatsApp Cloud API"
              desc="Send invoices and notifications through WhatsApp."
            />
          </Group>
        </PageContainer>
      </main>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-field-gap">
      <div className="px-1 text-tiny font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-field-gap">{children}</div>
    </section>
  );
}

function Tile({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-4 transition-colors hover:border-border"
    >
      <div className="grid h-10 w-10 place-items-center rounded-md bg-black text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

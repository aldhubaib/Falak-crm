"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/permissions";
import { MODULE_ICONS } from "@/components/module-icons";
import { usePermissions } from "@/components/permissions-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Which modules deserve a bottom-nav slot first (the rest live behind Menu).
const PRIORITY: ModuleKey[] = [
  "dashboard",
  "projects",
  "deals",
  "contacts",
  "companies",
  "publish",
  "invoices",
  "payments",
  "settings",
];

// Bottom-nav labels must fit under a 20px icon — shorten the long ones.
const SHORT_LABELS: Partial<Record<ModuleKey, string>> = {
  deals: "Deals",
  payments: "Payments",
};

// Mobile/tablet bottom navigation (hidden on desktop, where the sidebar rail
// lives). Max 5 slots: up to 4 modules + Menu, which opens the full drawer.
// Chat always gets a slot when the member may see it; permissions hide items
// exactly like the sidebar does.
export function MobileBottomNav() {
  const pathname = usePathname();
  const permissions = usePermissions();
  const { setOpenMobile } = useSidebar();

  const allowed = MODULES.filter(
    (m) => m.href && MODULE_ICONS[m.key] && permissions[m.key] !== "none",
  );
  const chat = allowed.find((m) => m.key === "chat");
  const slots = chat ? 3 : 4;
  const items = [
    ...PRIORITY.map((key) => allowed.find((m) => m.key === key))
      .filter((m) => m != null)
      .slice(0, slots),
    ...(chat ? [chat] : []),
  ];

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {items.map((m) => {
        const Icon = MODULE_ICONS[m.key]!;
        const active =
          pathname === m.href || pathname.startsWith(m.href! + "/");
        return (
          <Link
            key={m.key}
            href={m.href!}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5 text-[10px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">
              {SHORT_LABELS[m.key] ?? m.label}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Handshake,
  FolderKanban,
  FileText,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/components/permissions-provider";
import { type PermissionModule } from "@/lib/permissions";

type TabItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionModule;
};

const tabs: TabItem[] = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Deals", href: "/dashboard/deals", icon: Handshake, permission: "deals" },
  { name: "Projects", href: "/dashboard/projects", icon: FolderKanban, permission: "projects" },
  { name: "Invoices", href: "/dashboard/invoices", icon: FileText, permission: "invoices" },
  { name: "More", href: "/dashboard/more", icon: Menu },
];

export function BottomTabs() {
  const pathname = usePathname();
  const permissions = usePermissions();

  const isActive = (href: string) => {
    if (href === "/dashboard")
      return pathname === "/dashboard" || pathname === "/dashboard/";
    if (href === "/dashboard/more") {
      return ["/dashboard/companies", "/dashboard/contacts", "/dashboard/settings"].some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const visibleTabs = tabs.filter((tab) => {
    if (!tab.permission) return true;
    return permissions[tab.permission] !== "none";
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2 z-[100] pb-[env(safe-area-inset-bottom)]">
      {visibleTabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors no-underline min-w-[56px]",
              active
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <tab.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px] font-medium">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

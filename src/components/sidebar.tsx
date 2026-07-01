"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  FileText,
  CalendarDays,
  Settings,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/components/permissions-provider";
import { type PermissionModule } from "@/lib/permissions";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionModule;
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Deals", href: "/deals", icon: Handshake, permission: "deals" },
  { name: "Projects", href: "/projects", icon: FolderKanban, permission: "projects" },
  { name: "Invoices", href: "/invoices", icon: FileText, permission: "invoices" },
  { name: "Publish", href: "/publish", icon: CalendarDays, permission: "publish" },
  { name: "Settings", href: "/settings", icon: Settings, permission: "settings" },
];

interface SidebarProps {
  collapsed?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}

export function Sidebar({
  collapsed = false,
  pinned = false,
  onTogglePin,
}: SidebarProps) {
  const pathname = usePathname();
  const permissions = usePermissions();

  const isActive = (href: string) => {
    if (href === "/dashboard")
      return pathname === "/dashboard" || pathname === "/dashboard/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const visibleNav = navigation.filter((item) => {
    if (!item.permission) return true;
    return permissions[item.permission] !== "none";
  });

  return (
    <div
      className={cn(
        "flex flex-col bg-sidebar transition-all duration-200 h-screen sticky top-0 overflow-y-auto",
        collapsed ? "w-[56px] min-w-[56px]" : "w-[220px] min-w-[220px]"
      )}
    >
      {/* Header */}
      <div className="relative px-3 h-12 flex items-center justify-between shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
              F
            </div>
            <span className="font-semibold text-body text-foreground truncate">
              Falak CRM
            </span>
          </div>
        ) : (
          <div className="mx-auto">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">
              F
            </div>
          </div>
        )}

        {!collapsed && onTogglePin && (
          <button
            className={cn(
              "w-icon-btn h-icon-btn rounded-full flex items-center justify-center transition-colors",
              pinned
                ? "text-primary hover:bg-card/60"
                : "text-muted-foreground hover:bg-card/60"
            )}
            onClick={onTogglePin}
          >
            {pinned ? (
              <Pin className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
            ) : (
              <PinOff className="w-icon-sm h-icon-sm" strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-1.5 px-2 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = isActive(item.href);

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-full text-body font-medium transition-colors mb-0.5 no-underline",
                  collapsed ? "justify-center px-0 py-2" : "px-2.5 py-[7px]",
                  active
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                {!collapsed && item.name}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div
        className={cn(
          "px-3 py-3 flex items-center gap-2.5 hover:bg-card/60 transition-colors",
          collapsed && "justify-center"
        )}
      >
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-7 h-7",
            },
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";
import {
  LayoutGrid,
  Building2,
  Users,
  Handshake,
  FolderKanban,
  FileText,
  Wallet,
  CalendarDays,
  Settings,
  LogOut,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/permissions";
import { usePermissions } from "@/components/permissions-provider";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Icons are presentation-only; which items exist and who sees them is driven
// by the module registry in src/lib/permissions.ts.
const MODULE_ICONS: Partial<Record<ModuleKey, LucideIcon>> = {
  dashboard: LayoutGrid,
  companies: Building2,
  contacts: Users,
  deals: Handshake,
  projects: FolderKanban,
  invoices: FileText,
  payments: Wallet,
  publish: CalendarDays,
  settings: Settings,
};

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const permissions = usePermissions();

  // Every entry (including Dashboard) comes from the module registry and is
  // hidden entirely when the member's level for that module is "none" (route
  // guards enforce the same rule server-side).
  const items = MODULES.filter(
    (m) => m.href && MODULE_ICONS[m.key] && permissions[m.key] !== "none",
  ).map((m) => ({
    title: m.label,
    url: m.href!,
    icon: MODULE_ICONS[m.key]!,
  }));

  const handleSignOut = () => {
    setSignOutOpen(false);
    signOut({ redirectUrl: "/sign-in" });
  };

  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="px-2 pb-2 pt-3">
        <SidebarTrigger className="h-9 w-9" />
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const active =
              pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className="h-10 rounded-lg text-[14px] font-medium text-muted-foreground data-[active=true]:!bg-transparent data-[active=true]:text-primary hover:bg-accent/60 hover:text-foreground"
                >
                  <Link href={item.url} onClick={handleNav} className="flex items-center gap-3">
                    <item.icon className="h-[18px] w-[18px]" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4 group-data-[collapsible=icon]:px-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-accent/60 group-data-[collapsible=icon]:justify-center"
            >
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt={user.fullName ?? "You"}
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/80 text-xs font-semibold text-white">
                  {initials}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-medium text-foreground">
                    {user?.fullName || "User"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress || "Signed in"}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/account" onClick={handleNav} className="gap-2.5">
                <UserCog className="h-4 w-4" />
                Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 text-destructive focus:text-destructive [&_svg]:text-destructive"
              onSelect={() => setSignOutOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sign out</DialogTitle>
              <DialogDescription>
                Are you sure you want to sign out of your account?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setSignOutOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

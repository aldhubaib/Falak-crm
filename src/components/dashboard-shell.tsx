"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { BottomTabs } from "@/components/bottom-tabs";
import { ActivityPanel } from "@/components/activity-panel";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { TestRoleBanner } from "@/components/test-role-banner";
import { UploadIndicator } from "@/components/upload-indicator";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Companies",
  "/contacts": "Contacts",
  "/deals": "Deals",
  "/projects": "Projects",
  "/invoices": "Invoices",
  "/publish": "Publish",
  "/more": "More",
  "/settings": "Settings",
  "/settings/team": "Team & Roles",
  "/settings/billing": "Billing",
  "/settings/whatsapp": "WhatsApp",
  "/settings/checklists": "Checklists",
  "/settings/statuses": "Statuses",
  "/settings/pipelines": "Pipelines",
  "/settings/services": "Services",
  "/settings/currencies": "Currencies",
  "/settings/industries": "Industries",
  "/settings/referrals": "Referrals",
  "/settings/trash": "Trash",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i >= 2; i--) {
    const prefix = "/" + segments.slice(0, i).join("/");
    if (PAGE_TITLES[prefix]) return PAGE_TITLES[prefix];
  }
  return "";
}

function hasOwnHeader(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "projects" && segments.length >= 2) return true;
  if (segments[0] === "deals" && segments.length >= 2) return true;
  if (segments[0] === "companies" && segments.length >= 2) return true;
  if (segments[0] === "contacts" && segments.length >= 2) return true;
  if (segments[0] === "invoices" && segments.length >= 2) return true;
  if (segments[0] === "settings" && segments.length >= 2) return true;
  return false;
}

const DESKTOP_BREAKPOINT = 1024;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const handleResize = () =>
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (isDesktop && drawerOpen) setDrawerOpen(false);
  }, [isDesktop, drawerOpen]);

  const expanded = pinned || hovered;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      {isDesktop && (
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <Sidebar
            collapsed={!expanded}
            pinned={pinned}
            onTogglePin={() => setPinned(!pinned)}
          />
        </div>
      )}

      {/* Mobile header */}
      {!isDesktop && !hasOwnHeader(pathname) && (
        <div className="fixed top-0 left-0 right-0 h-12 flex items-center justify-between px-4 border-b border-border bg-background z-[100]">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <Menu className="w-icon-md h-icon-md" />
          </button>
          <span className="font-semibold text-subheading text-foreground">
            {pageTitle || "Dashboard"}
          </span>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationBell />
            <ActivityPanel />
          </div>
        </div>
      )}

      {/* Mobile drawer overlay */}
      {!isDesktop && drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[500] backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      {!isDesktop && (
        <div
          className={cn(
            "fixed top-0 left-0 w-[260px] h-screen bg-sidebar border-r border-sidebar-border z-[600] transition-transform duration-200 ease-out",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <main
        className={cn(
          "flex-1 min-w-0 bg-background relative z-10 flex flex-col",
          isDesktop ? "rounded-l-2xl" : hasOwnHeader(pathname) ? "pb-16" : "pt-12 pb-16"
        )}
      >
        <TestRoleBanner />
        {/* Top bar — only on pages without their own header */}
        {isDesktop && !hasOwnHeader(pathname) && (
          <div className="flex items-center justify-between px-6 h-12 shrink-0 border-b border-border/50">
            <h1 className="text-subheading font-semibold text-foreground">{pageTitle}</h1>
            <div className="flex items-center gap-2">
              <GlobalSearch />
              <NotificationBell />
              <ActivityPanel />
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      {!isDesktop && <BottomTabs />}

      <UploadIndicator />
    </div>
  );
}

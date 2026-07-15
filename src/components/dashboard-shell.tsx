"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { UploadIndicator } from "@/components/upload-indicator";
import { TestRoleBanner } from "@/components/test-role-banner";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { rememberInboxReturnPath } from "@/lib/inbox-return";

export function DashboardShell({ children }: { children: ReactNode }) {
  // Remember the last page outside the inbox overlay so its close button can
  // bring the user back to exactly where they opened it from.
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/messages")) rememberInboxReturnPath(pathname);
  }, [pathname]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <MobileBottomNav />
        </div>
      </div>
      <UploadIndicator />
      <TestRoleBanner />
      <PullToRefresh />
    </SidebarProvider>
  );
}

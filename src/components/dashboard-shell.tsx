"use client";

import { type ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { UploadIndicator } from "@/components/upload-indicator";
import { TestRoleBanner } from "@/components/test-role-banner";
import { PullToRefresh } from "@/components/pull-to-refresh";

export function DashboardShell({ children }: { children: ReactNode }) {
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

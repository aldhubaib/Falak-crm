"use client";

import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

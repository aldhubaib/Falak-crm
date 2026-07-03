"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppHeaderProps {
  title?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ title, leading, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:h-16 sm:px-5">
      <SidebarTrigger className="shrink-0 lg:hidden" />

      {leading}

      <div className="min-w-0 flex-1">
        {typeof title === "string" ? (
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {title}
          </h1>
        ) : (
          title ?? (
            <span className="truncate text-sm font-semibold tracking-tight">
              Falak CRM
            </span>
          )
        )}
      </div>

      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}

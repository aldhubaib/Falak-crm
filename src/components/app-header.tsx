"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsBell } from "@/components/notifications-bell";

interface AppHeaderProps {
  title?: ReactNode;
  /** Show a back arrow linking to this href instead of the sidebar trigger. */
  backHref?: string;
  /** Node rendered between back/trigger and the title (e.g. avatar). */
  leading?: ReactNode;
  /** Right-hand actions. Notification bell is always shown unless hideNotifications is true. */
  actions?: ReactNode;
  /** Hide the default notification bell. */
  hideNotifications?: boolean;
}

export function AppHeader({
  title,
  backHref,
  leading,
  actions,
  hideNotifications,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:h-16 sm:px-5">
      {backHref ? (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          aria-label="Back"
        >
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <SidebarTrigger className="shrink-0 lg:hidden" />
      )}

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

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {!hideNotifications && <NotificationsBell />}
        {actions}
      </div>
    </header>
  );
}

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notifications";
import { useCentrifugo } from "@/components/realtime/centrifugo-provider";
import { useChannel } from "@/components/realtime/hooks";
import { userChannel } from "@/lib/channels";
import {
  closeDisplayedNotifications,
  closeDisplayedNotificationsByTag,
  syncAppBadge,
} from "@/lib/app-badge";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: Date;
};

function formatRelative(date: Date) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.max(1, Math.floor(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const [items, count] = await Promise.all([
          getNotifications(30),
          getUnreadCount(),
        ]);
        setNotifications(items);
        setUnreadCount(count);
      } catch {
        // Network or auth error — silently ignore, will retry
      }
    });
  }, [startTransition]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Mirror the unread count on the OS app icon (installed PWA). The service
  // worker sets it when a push arrives while the app is closed; this keeps it
  // in sync while the app is in use and, once everything is read, also closes
  // the push notifications left in the system tray (Android launchers derive
  // the badge from those, so clearAppBadge alone isn't enough).
  useEffect(() => {
    void syncAppBadge(unreadCount);
  }, [unreadCount]);

  // Instant updates: refresh the moment something lands on our user channel.
  // A `notification.read` event means notifications were read on another
  // device — also close the matching push notifications in this device's tray.
  const cent = useCentrifugo();
  useChannel(cent ? userChannel(cent.memberId) : null, (data) => {
    refresh();
    const event = data as {
      type?: string;
      clearAll?: boolean;
      tags?: string[];
    };
    if (event?.type === "notification.read") {
      if (event.clearAll) void closeDisplayedNotifications();
      else if (event.tags?.length)
        void closeDisplayedNotificationsByTag(event.tags);
    }
  });

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleMarkAllRead = () => {
    startTransition(async () => {
      try {
        await markAllNotificationsRead();
        refresh();
      } catch {}
    });
  };

  const handleClick = (n: Notification) => {
    if (!n.read) {
      startTransition(async () => {
        try {
          await markNotificationRead(n.id);
          refresh();
        } catch {}
      });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xxs font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Mark all read"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Open full inbox"
              onClick={() => setOpen(false)}
            >
              <Link href="/messages">
                <Maximize2 className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        {notifications.length === 0 ? (
          <div className="grid place-items-center gap-2 p-8 text-center text-xs text-muted-foreground">
            <Bell className="h-6 w-6 opacity-60" />
            No notifications yet
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {notifications.map((n) => {
              const inner = (
                <div
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-surface/60",
                    !n.read && "bg-primary/[0.06]",
                  )}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {n.title}
                      </span>
                      <span className="ml-auto shrink-0 text-xxs text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {n.body}
                      </div>
                    )}
                  </div>
                  {!n.read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              );

              return (
                <li key={n.id}>
                  {n.linkUrl ? (
                    <Link
                      href={n.linkUrl}
                      onClick={() => handleClick(n)}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className="w-full text-left"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

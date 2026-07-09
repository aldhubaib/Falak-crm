"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, Maximize2, Volume2, X } from "lucide-react";
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
import {
  playNotificationSound,
  previewNotificationSound,
  invalidateNotificationSoundCache,
  ensureNotificationSoundCached,
} from "@/lib/notification-sound";

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
  const [soundUpdated, setSoundUpdated] = useState(false);
  const [, startTransition] = useTransition();

  // Download the workspace notification sound into the local cache once per
  // session so the first notification plays instantly (and offline).
  useEffect(() => {
    void ensureNotificationSoundCached();
  }, []);

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

  // Polling is the fallback only: while the realtime socket is connected,
  // pushes on the user channel drive updates and the 30s poll stays off.
  const cent = useCentrifugo();
  const realtimeActive = Boolean(cent?.enabled && cent.connected);
  useEffect(() => {
    refresh();
    if (realtimeActive) return;
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh, realtimeActive]);

  // Resync after a realtime outage (see CentrifugoProvider).
  useEffect(() => {
    const onResync = () => refresh();
    window.addEventListener("realtime:resync", onResync);
    return () => window.removeEventListener("realtime:resync", onResync);
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
  // Debounced — a message send emits both an "inbox" and a "notification.new"
  // event within milliseconds; one refetch covers both. A `notification.read`
  // event means notifications were read on another device — also close the
  // matching push notifications in this device's tray.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
  useChannel(cent ? userChannel(cent.memberId) : null, (data) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 400);
    const event = data as {
      type?: string;
      clearAll?: boolean;
      tags?: string[];
    };
    if (event?.type === "notification.new") {
      void playNotificationSound();
    }
    // Admin replaced the workspace notification sound — drop the local copy,
    // download the new file right away, and tell the user about it.
    if (event?.type === "notification.sound-updated") {
      invalidateNotificationSoundCache();
      setSoundUpdated(true);
    }
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
    <>
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

      {/* Sound-updated popup: same placement/style as the PWA update banner.
        The new file is already downloaded by the time this shows — the button
        both confirms and (being a user gesture) is guaranteed to be audible. */}
      {soundUpdated && (
        <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[9999] flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-x-0 sm:bottom-6">
          <div className="flex w-full max-w-sm items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                Notification sound updated
              </div>
              <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
                Your notifications will now use the new sound.
              </div>
              <button
                onClick={() => {
                  void previewNotificationSound();
                  setSoundUpdated(false);
                }}
                className="mt-3 flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
              >
                Hear it
              </button>
            </div>
            <button
              onClick={() => setSoundUpdated(false)}
              aria-label="Dismiss"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Users, Folder, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/actions/messages";

function formatRelative(iso: string) {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function ThreadSidebar({ threads }: { threads: InboxThread[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "project" | "notification">("all");

  const rows = useMemo(() => {
    return threads
      .filter((t) => (tab === "all" ? true : t.kind === tab))
      .filter((t) =>
        q
          ? t.name.toLowerCase().includes(q.toLowerCase()) ||
            t.subtitle.toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .sort(
        (a, b) =>
          new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
  }, [threads, tab, q]);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border/60">
      <div className="flex h-14 items-center gap-2 border-b border-border/60 px-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Close"
        >
          <Link href="/dashboard">
            <X className="h-4 w-4" />
          </Link>
        </Button>
        <div className="text-sm font-semibold">Inbox</div>
      </div>

      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="mt-2 flex items-center gap-1 rounded-md bg-surface/60 p-0.5">
          {(
            [
              { id: "all" as const, label: "All", icon: Users },
              { id: "project" as const, label: "Projects", icon: Folder },
              {
                id: "notification" as const,
                label: "Direct",
                icon: MessageSquare,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <li className="p-6 text-center text-xs text-muted-foreground">
            No conversations
          </li>
        )}
        {rows.map((thread) => {
          const href = `/messages/${thread.id}`;
          const active = pathname === href;
          return (
            <li key={thread.id}>
              <Link
                href={href}
                className={cn(
                  "flex items-start gap-3 border-b border-border/40 px-3 py-3 transition-colors hover:bg-surface/60",
                  active && "bg-surface/80",
                  thread.unread > 0 && !active && "bg-primary/[0.05]",
                )}
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-tiny font-semibold text-white"
                  style={{ background: thread.avatar }}
                  aria-hidden
                >
                  {thread.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {thread.name}
                    </span>
                    <span className="ml-auto shrink-0 text-xxs text-muted-foreground">
                      {formatRelative(thread.lastAt)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {thread.lastAuthor
                      ? `${thread.lastAuthor}: ${thread.lastMessage}`
                      : thread.subtitle}
                  </div>
                </div>
                {thread.unread > 0 && (
                  <span className="mt-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xxs font-semibold text-primary-foreground">
                    {thread.unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Users,
  Folder,
  MessageSquare,
  PenSquare,
  Archive,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getInboxThreads,
  getMessageableMembers,
  getOrCreateDirectConversation,
  type InboxThread,
} from "@/actions/messages";
import { useCentrifugo } from "@/components/realtime/centrifugo-provider";
import { useChannel, usePresence } from "@/components/realtime/hooks";
import { usePermissions } from "@/components/permissions-provider";
import { userChannel, workspacePresenceChannel } from "@/lib/channels";
import { PublishAvatar } from "@/components/publish/publish-avatar";

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

type Member = { id: string; name: string | null; email: string };

// True when the user is viewing a specific thread (not the inbox index).
function useOnThread() {
  const pathname = usePathname();
  return pathname.startsWith("/messages/") && pathname !== "/messages";
}

// Client wrapper for the thread pane: full-screen on mobile only when a
// thread is open, always visible on desktop.
export function MessagesMain({ children }: { children: React.ReactNode }) {
  const onThread = useOnThread();
  return (
    <main
      className={cn(
        "min-w-0 flex-1 flex-col",
        onThread ? "flex" : "hidden lg:flex",
      )}
    >
      {children}
    </main>
  );
}

export function ThreadSidebar({ threads: initialThreads }: { threads: InboxThread[] }) {
  const pathname = usePathname();
  const onThread = useOnThread();
  const [q, setQ] = useState("");
  // The search field hides behind the header's magnifier icon until needed.
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "project" | "direct">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const permissions = usePermissions();
  const canCompose = permissions.chat === "full";

  // The thread list lives in local state and refetches via the server action —
  // NOT router.refresh(), which re-rendered the whole RSC tree (layout + open
  // thread) on every inbox ping and thread switch.
  const [threads, setThreads] = useState<InboxThread[]>(initialThreads);
  useEffect(() => setThreads(initialThreads), [initialThreads]);
  const refetching = useRef(false);
  const refetchThreads = useCallback(() => {
    if (refetching.current) return;
    refetching.current = true;
    getInboxThreads()
      .then(setThreads)
      .catch(() => {})
      .finally(() => {
        refetching.current = false;
      });
  }, []);

  const cent = useCentrifugo();
  const online = usePresence(
    cent ? workspacePresenceChannel(cent.workspaceId) : null,
  );

  // Live inbox: refetch the thread list when anything lands on our user channel.
  useChannel(cent ? userChannel(cent.memberId) : null, (data) => {
    const d = data as { type?: string } | null;
    if (d?.type === "inbox") refetchThreads();
  });

  // Resync after a realtime outage (see CentrifugoProvider).
  useEffect(() => {
    const onResync = () => refetchThreads();
    window.addEventListener("realtime:resync", onResync);
    return () => window.removeEventListener("realtime:resync", onResync);
  }, [refetchThreads]);

  // Opening a thread marks its notifications read on the server, but this
  // sidebar lives in the layout and keeps its stale thread list across
  // navigations — refetch it so the unread counter clears.
  useEffect(() => {
    if (onThread) refetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const allRows = useMemo(() => {
    return threads
      .filter((t) => (tab === "all" ? true : t.kind === tab))
      .filter((t) =>
        q
          ? t.name.toLowerCase().includes(q.toLowerCase()) ||
            t.subtitle.toLowerCase().includes(q.toLowerCase())
          : true,
      )
      .sort((a, b) => {
        // Threads with no messages yet have an empty lastAt — sort them last.
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return tb - ta;
      });
  }, [threads, tab, q]);

  // Non-active projects collapse into an "Archived projects" section.
  const rows = useMemo(() => allRows.filter((t) => !t.archived), [allRows]);
  const archivedRows = useMemo(
    () => allRows.filter((t) => t.archived),
    [allRows],
  );
  const showArchivedSection = tab !== "direct" && archivedRows.length > 0;

  return (
    <aside
      className={cn(
        "flex-col border-r border-border/60 lg:flex lg:w-80 lg:shrink-0",
        onThread ? "hidden lg:flex" : "flex w-full",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border/60 px-3">
        <div className="text-sm font-semibold">Inbox</div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={searchOpen ? "Hide search" : "Search conversations"}
            onClick={() =>
              setSearchOpen((open) => {
                if (open) setQ("");
                return !open;
              })
            }
          >
            <Search className="h-4 w-4" />
          </Button>
          {canCompose && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="New message"
              onClick={() => setComposeOpen(true)}
            >
              <PenSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border/60 p-3">
        {searchOpen && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations"
              className="h-9 pl-8 text-sm"
              autoFocus
            />
          </div>
        )}
        <div className="flex items-center gap-1 rounded-md bg-surface/60 p-0.5">
          {(
            [
              { id: "all" as const, label: "All", icon: Users },
              { id: "project" as const, label: "Projects", icon: Folder },
              { id: "direct" as const, label: "Direct", icon: MessageSquare },
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
        {rows.length === 0 && !showArchivedSection && (
          <li className="p-6 text-center text-xs text-muted-foreground">
            No conversations
          </li>
        )}
        {rows.map((thread) => (
          <li key={thread.id}>
            <ThreadRow
              thread={thread}
              active={pathname === `/messages/${thread.id}`}
              isOnline={
                thread.kind === "direct" &&
                thread.peerMemberIds.some((id) => online.has(id))
              }
            />
          </li>
        ))}
        {showArchivedSection && (
          <li>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center gap-2 border-y border-border/40 bg-surface/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface/60"
              aria-expanded={showArchived}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archived projects</span>
              <span className="ml-1 rounded-full bg-surface px-1.5 text-tiny">
                {archivedRows.length}
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto h-3.5 w-3.5 transition-transform",
                  showArchived && "rotate-180",
                )}
              />
            </button>
            {showArchived && (
              <ul>
                {archivedRows.map((thread) => (
                  <li key={thread.id}>
                    <ThreadRow
                      thread={thread}
                      active={pathname === `/messages/${thread.id}`}
                      isOnline={false}
                      archived
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        online={online}
      />
    </aside>
  );
}

function ThreadRow({
  thread,
  active,
  isOnline,
  archived = false,
}: {
  thread: InboxThread;
  active: boolean;
  isOnline: boolean;
  archived?: boolean;
}) {
  return (
    <Link
      href={`/messages/${thread.id}`}
      className={cn(
        "flex items-start gap-3 border-b border-border/40 px-3 py-3 transition-colors hover:bg-surface/60",
        active && "bg-surface/80",
        !archived && thread.unread > 0 && !active && "bg-primary/[0.05]",
        archived && "opacity-60 hover:opacity-80",
        archived && active && "opacity-100",
      )}
    >
      <div className="relative shrink-0">
        {thread.imageUrl ? (
          <Image
            src={thread.imageUrl}
            alt={thread.name}
            width={36}
            height={36}
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <PublishAvatar
            name={thread.name}
            thumbnailId={thread.thumbnailId}
            size={36}
            fallback={
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-tiny font-semibold text-white"
                style={{ background: thread.avatar }}
                aria-hidden
              >
                {thread.initials}
              </div>
            }
          />
        )}
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {archived && (
            <span
              className="grid size-5 shrink-0 place-items-center rounded-md bg-surface/80 text-muted-foreground"
              title="Archived project"
              aria-label="Archived project"
            >
              <Archive className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="truncate text-sm font-medium">{thread.name}</span>
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
      {/* The open thread is being read right now — its badge clears
          immediately instead of waiting for the server refetch. */}
      {thread.unread > 0 && !active && (
        <span
          className={cn(
            // Compact 14px circle with a 9px digit so it reads the same as the
            // corner badges on the bell / publish icons; leading-none keeps
            // the digit vertically centered (inherited line-height and iOS
            // font scaling otherwise push it below).
            "mt-2 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none",
            archived
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {thread.unread > 9 ? "9+" : thread.unread}
        </span>
      )}
    </Link>
  );
}

function ComposeDialog({
  open,
  onClose,
  online,
}: {
  open: boolean;
  onClose: () => void;
  online: Set<string>;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMessageableMembers()
      .then((m) => setMembers(m))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = members.filter((m) => {
    if (!q) return true;
    const name = (m.name ?? m.email).toLowerCase();
    return name.includes(q.toLowerCase());
  });

  const openWith = async (memberId: string) => {
    if (opening) return;
    setOpening(true);
    const res = await getOrCreateDirectConversation(memberId);
    setOpening(false);
    if (res.ok) {
      onClose();
      setQ("");
      router.push(`/messages/conv-${res.data}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people"
            className="h-9 pl-8 text-sm"
            autoFocus
          />
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {loading && (
            <li className="p-4 text-center text-xs text-muted-foreground">
              Loading…
            </li>
          )}
          {!loading && filtered.length === 0 && (
            <li className="p-4 text-center text-xs text-muted-foreground">
              No people found
            </li>
          )}
          {filtered.map((m) => {
            const name = m.name ?? m.email;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => openWith(m.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface/60 disabled:opacity-60"
                >
                  <div className="relative shrink-0">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xxs font-semibold text-primary">
                      {name
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    {online.has(m.id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{name}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

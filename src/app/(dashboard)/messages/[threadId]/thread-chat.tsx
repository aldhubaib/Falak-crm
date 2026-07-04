"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Send,
  X,
  FileText,
  Loader2,
  UploadCloud,
  Search,
  Files as FilesIcon,
  MoreVertical,
  ChevronDown,
  Reply,
  Copy,
  Forward,
  Pin,
  Star,
  Trash2,
  Clock,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  sendMessage,
  toggleReaction,
  deleteMessage as deleteMessageAction,
  getThreadMessages,
  type MessageDTO,
  type MessageAttachment,
  type ReactionSummary,
} from "@/actions/messages";
import { useChannel, usePresence, useTyping } from "@/components/realtime/hooks";
import {
  AttachmentBubble,
  Lightbox,
  useLightbox,
  FilesPanel,
} from "@/components/messages/chat-attachments";
import { uploadManager, type UploadItem } from "@/lib/upload-manager";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: MessageAttachment[];
  reactions: ReactionSummary[];
  replyToId?: string | null;
};

export type ThreadTarget = {
  taskId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const EMPTY_UPLOADS: UploadItem[] = [];

// A file picked in the composer, held locally until the user presses Send.
type PendingFile = { key: string; file: File; previewUrl: string | null };

// A message the user has sent that is still uploading/delivering — rendered as
// a bubble with progress (WhatsApp-style optimistic send).
type OutboxEntry = {
  tempId: string;
  body: string;
  replyToId: string | null;
  createdAt: string;
  files: {
    uploadId: string;
    name: string;
    contentType: string | null;
    previewUrl: string | null;
  }[];
  status: "uploading" | "sending" | "error";
};

export function ThreadChat({
  channel,
  presenceChannel,
  target,
  title,
  subtitle,
  currentMemberId,
  messages: initialMessages,
  hasMoreOlder = false,
  memberNames = {},
  peerMemberIds = [],
}: {
  channel: string;
  presenceChannel: string | null;
  target: ThreadTarget;
  title: string;
  subtitle: string;
  currentMemberId: string;
  messages: ChatMessage[];
  hasMoreOlder?: boolean;
  memberNames?: Record<string, string>;
  peerMemberIds?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const skipAutoScrollRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const dispatchedRef = useRef<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<"chat" | "files">("chat");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const lb = useLightbox();

  const subscribe = useCallback((cb: () => void) => uploadManager.subscribe(cb), []);
  const getSnapshot = useCallback(() => uploadManager.getItems(), []);
  const getServerSnapshot = useCallback(() => EMPTY_UPLOADS, []);
  const allUploads = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const uploadById = useMemo(() => {
    const map = new Map<string, UploadItem>();
    for (const u of allUploads) map.set(u.id, u);
    return map;
  }, [allUploads]);

  const online = usePresence(presenceChannel);
  const { typing, notifyTyping } = useTyping(channel);

  useEffect(() => {
    setMessages(initialMessages);
    setHasMore(hasMoreOlder);
  }, [initialMessages, hasMoreOlder]);

  // Fetch the previous page (older messages) and prepend it, keeping the
  // viewport anchored so the list doesn't jump.
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    const el = scrollerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const page = await getThreadMessages({
        ...target,
        cursorId: messages[0].id,
      });
      skipAutoScrollRef.current = true;
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m) => !existing.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        const scroller = scrollerRef.current;
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight - prevHeight + prevTop;
        }
      });
    } catch {
      // Best-effort — the button stays available for a retry.
    } finally {
      setLoadingOlder(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingOlder, hasMore, messages, target.taskId, target.projectId, target.conversationId]);

  // Free preview object URLs if the user leaves the thread without sending.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      for (const p of pendingRef.current) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    },
    [],
  );

  useChannel(channel, (data) => {
    const d = data as
      | {
          type?: string;
          message?: MessageDTO;
          messageId?: string;
          reactions?: ReactionSummary[];
        }
      | null;
    if (!d) return;
    if (d.type === "message.new" && d.message) {
      const m = d.message;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [
          ...prev,
          {
            id: m.id,
            authorId: m.authorId,
            authorName: m.authorName,
            body: m.body,
            createdAt: m.createdAt,
            attachments: m.attachments ?? [],
            reactions: [],
          },
        ];
      });
    } else if (d.type === "reaction.updated" && d.messageId) {
      const { messageId, reactions } = d;
      setMessages((prev) =>
        prev.map((x) =>
          x.id === messageId ? { ...x, reactions: reactions ?? [] } : x,
        ),
      );
    }
  });

  useEffect(() => {
    // Prepending older pages must not yank the user to the bottom.
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing.length, outbox.length]);

  const byId = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Files wait locally (no upload) until the user presses Send — WhatsApp-style.
  const pickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked: PendingFile[] = Array.from(files)
      .filter((f) => f.size > 0)
      .map((file) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      }));
    setPending((prev) => [...prev, ...picked]);
  };

  const removePending = (key: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    pickFiles(e.dataTransfer.files);
  };

  // Deliver an outbox entry once its uploads are done. Bubble stays in the
  // list with progress until the server confirms, then the real message
  // replaces it.
  const deliver = useCallback(
    (entry: OutboxEntry, attachmentIds: string[]) => {
      setOutbox((prev) =>
        prev.map((o) =>
          o.tempId === entry.tempId ? { ...o, status: "sending" } : o,
        ),
      );
      startTransition(async () => {
        const res = await sendMessage({
          ...target,
          body: entry.body,
          attachmentIds,
          replyToId: entry.replyToId ?? undefined,
        });
        if (res.ok) {
          const m = res.data;
          for (const f of entry.files) {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
          }
          uploadManager.removeItems(entry.files.map((f) => f.uploadId));
          setOutbox((prev) => prev.filter((o) => o.tempId !== entry.tempId));
          setMessages((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: m.id,
                    authorId: m.authorId,
                    authorName: m.authorName,
                    body: m.body,
                    createdAt: m.createdAt,
                    attachments: m.attachments,
                    reactions: [],
                    replyToId: entry.replyToId,
                  },
                ],
          );
          router.refresh();
        } else {
          dispatchedRef.current.delete(entry.tempId);
          setOutbox((prev) =>
            prev.map((o) =>
              o.tempId === entry.tempId ? { ...o, status: "error" } : o,
            ),
          );
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target.taskId, target.projectId, target.conversationId, router],
  );

  // Watch uploads for outbox entries: when all of an entry's files are
  // uploaded, send the message; if any upload failed, mark the entry.
  useEffect(() => {
    for (const entry of outbox) {
      if (entry.status !== "uploading") continue;
      if (dispatchedRef.current.has(entry.tempId)) continue;
      const items = entry.files.map((f) => uploadById.get(f.uploadId));
      if (items.some((i) => !i || i.status === "error")) {
        setOutbox((prev) =>
          prev.map((o) =>
            o.tempId === entry.tempId ? { ...o, status: "error" } : o,
          ),
        );
        continue;
      }
      if (items.every((i) => i!.status === "done" && i!.attachmentId)) {
        dispatchedRef.current.add(entry.tempId);
        deliver(entry, items.map((i) => i!.attachmentId!));
      }
    }
  }, [outbox, uploadById, deliver]);

  const send = () => {
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    const files = [...pending];
    const replyId = replyTo;
    setDraft("");
    setPending([]);
    setReplyTo(null);

    if (files.length === 0) {
      // Text-only: send straight away (no upload phase).
      const entry: OutboxEntry = {
        tempId: `out-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        body: text,
        replyToId: replyId,
        createdAt: new Date().toISOString(),
        files: [],
        status: "sending",
      };
      setOutbox((prev) => [...prev, entry]);
      dispatchedRef.current.add(entry.tempId);
      deliver(entry, []);
      return;
    }

    // With attachments: show the bubble immediately, upload in the background,
    // then deliver once the bytes are up (WhatsApp behavior).
    const ids = uploadManager.enqueueMessage(files.map((f) => f.file));
    const entry: OutboxEntry = {
      tempId: `out-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      body: text,
      replyToId: replyId,
      createdAt: new Date().toISOString(),
      files: files.map((f, i) => ({
        uploadId: ids[i],
        name: f.file.name,
        contentType: f.file.type || null,
        previewUrl: f.previewUrl,
      })),
      status: "uploading",
    };
    setOutbox((prev) => [...prev, entry]);
  };

  const retryOutbox = (tempId: string) => {
    const entry = outbox.find((o) => o.tempId === tempId);
    if (!entry) return;
    for (const f of entry.files) {
      const item = uploadById.get(f.uploadId);
      if (item?.status === "error") uploadManager.retry(f.uploadId);
    }
    dispatchedRef.current.delete(tempId);
    setOutbox((prev) =>
      prev.map((o) =>
        o.tempId === tempId
          ? { ...o, status: entry.files.length > 0 ? "uploading" : "sending" }
          : o,
      ),
    );
    if (entry.files.length === 0) {
      dispatchedRef.current.add(tempId);
      deliver({ ...entry, status: "sending" }, []);
    }
  };

  const discardOutbox = (tempId: string) => {
    const entry = outbox.find((o) => o.tempId === tempId);
    if (!entry) return;
    for (const f of entry.files) {
      uploadManager.cancel(f.uploadId);
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    }
    dispatchedRef.current.delete(tempId);
    setOutbox((prev) => prev.filter((o) => o.tempId !== tempId));
  };

  const react = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        let reactions: ReactionSummary[];
        if (existing) {
          const mine = existing.memberIds.includes(currentMemberId);
          const memberIds = mine
            ? existing.memberIds.filter((id) => id !== currentMemberId)
            : [...existing.memberIds, currentMemberId];
          reactions = memberIds.length
            ? m.reactions.map((r) => (r.emoji === emoji ? { ...r, memberIds } : r))
            : m.reactions.filter((r) => r.emoji !== emoji);
        } else {
          reactions = [...m.reactions, { emoji, memberIds: [currentMemberId] }];
        }
        return { ...m, reactions };
      }),
    );
    startTransition(async () => {
      await toggleReaction(messageId, emoji);
    });
  };

  const handleReply = (id: string) => {
    setReplyTo(id);
    setTimeout(() => composerRef.current?.focus(), 0);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      await deleteMessageAction(id);
    });
  };

  const peersOnline = peerMemberIds.some((id) => online.has(id));
  const typingLabel = useMemo(() => {
    const names = typing.map((id) => memberNames[id] ?? "Someone");
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return "Several people are typing…";
  }, [typing, memberNames]);

  const sq = searchQuery.trim().toLowerCase();
  const searchMatches = useMemo(() => {
    if (!sq) return null;
    return messages.filter((m) => m.body.toLowerCase().includes(sq));
  }, [messages, sq]);

  const matchIds = useMemo(() => {
    if (!searchMatches) return null;
    return new Set(searchMatches.map((m) => m.id));
  }, [searchMatches]);

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/60", "rounded-2xl");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary/60", "rounded-2xl"), 1500);
  };

  const allImages = useMemo(
    () => messages.flatMap((m) => m.attachments.filter((a) => a.isImage)),
    [messages],
  );

  const msgByAttachmentId = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) for (const a of m.attachments) map.set(a.id, m);
    return map;
  }, [messages]);

  const openImage = (att: MessageAttachment) => lb.open(att, allImages);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const replyingTo = replyTo ? byId.get(replyTo) : null;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-surface/80 px-10 py-8 text-primary">
            <UploadCloud className="h-8 w-8" />
            <span className="text-sm font-semibold">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Thread header */}
      <div className="flex h-14 items-center gap-3 border-b border-border/60 px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{title}</span>
            {peerMemberIds.length > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xxs",
                  peersOnline ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    peersOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
                  )}
                />
                {peersOnline ? "Online" : "Offline"}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="More options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => { setView("chat"); setSearchOpen(true); }}>
              <Search className="h-4 w-4" />
              <span className="flex-1">Search</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setView(view === "files" ? "chat" : "files")}>
              <FilesIcon className="h-4 w-4" />
              <span className="flex-1">Files</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingOlder}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-60"
              >
                {loadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}
          {messages.map((m, i) => {
            const mine = m.authorId === currentMemberId;
            const prev = messages[i - 1];
            const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            const newGroup = !prev || prev.authorId !== m.authorId || showDay;
            const showAuthor = !mine && newGroup;
            const dimmed = sq && matchIds && !matchIds.has(m.id);
            const replied = m.replyToId ? byId.get(m.replyToId) : null;
            const imageAtts = m.attachments.filter((a) => a.isImage);
            const fileAtts = m.attachments.filter((a) => !a.isImage);

            return (
              <div key={m.id} id={`msg-${m.id}`} className={cn("contents", dimmed && "opacity-30")}>
                {showDay && (
                  <div className="my-2 flex items-center justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-tiny font-medium text-muted-foreground">
                      {formatDay(m.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex gap-2",
                    mine ? "justify-end" : "justify-start",
                    newGroup && !showDay && i > 0 && "mt-3",
                  )}
                >
                  {!mine && (
                    <div className="w-8 shrink-0 self-start">
                      {showAuthor && (
                        <div
                          className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xxs font-semibold text-primary"
                          aria-hidden
                        >
                          {m.authorName
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={cn("flex max-w-[70%] flex-col gap-1.5", mine && "items-end")}>
                    {showAuthor && (
                      <div className="px-1 text-tiny text-muted-foreground">{m.authorName}</div>
                    )}
                    {(m.body || replied) && (
                      <div className="group relative">
                        <div
                          className={cn(
                            "flex max-w-full flex-col gap-1 rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-surface-2 text-foreground",
                          )}
                        >
                          {replied && (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(m.replyToId!)}
                              className={cn(
                                "-mx-1 flex flex-col gap-0.5 rounded-md border-l-2 px-2 py-1 text-left text-xs",
                                mine
                                  ? "border-primary-foreground/60 bg-primary-foreground/10 text-primary-foreground/90"
                                  : "border-primary/70 bg-primary/10 text-foreground/80",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-[11px] font-semibold",
                                  mine ? "text-primary-foreground" : "text-primary",
                                )}
                              >
                                {replied.authorId === currentMemberId ? "You" : replied.authorName}
                              </span>
                              <span className="line-clamp-2 opacity-90">
                                {replied.body
                                  ? replied.body.length > 120
                                    ? `${replied.body.slice(0, 120)}…`
                                    : replied.body
                                  : "Attachment"}
                              </span>
                            </button>
                          )}
                          {m.body && (
                            <div className="flex items-end gap-2">
                              <span className="whitespace-pre-wrap break-words">{m.body}</span>
                              <span
                                className={cn(
                                  "ml-1 shrink-0 translate-y-0.5 text-[10px] leading-none",
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground",
                                )}
                              >
                                {formatTime(m.createdAt)}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Message caret dropdown */}
                        <MessageCaret
                          mine={mine}
                          onReact={(emoji) => react(m.id, emoji)}
                          onReply={() => handleReply(m.id)}
                          onCopy={() => handleCopy(m.body)}
                          onDelete={() => handleDelete(m.id)}
                        />
                      </div>
                    )}
                    {imageAtts.length > 0 && (
                      <div
                        className={cn(
                          "flex max-w-full flex-wrap gap-1.5",
                          mine ? "justify-end" : "justify-start",
                        )}
                      >
                        {imageAtts.map((a) => (
                          <AttachmentBubble
                            key={a.id}
                            attachment={a}
                            mine={mine}
                            onOpenImage={openImage}
                            menu={
                              <ImageActionsMenu
                                onReact={(emoji) => react(m.id, emoji)}
                                onReply={() => handleReply(m.id)}
                                onCopy={() => handleCopy(m.body)}
                                onDelete={() => handleDelete(m.id)}
                              />
                            }
                          />
                        ))}
                      </div>
                    )}
                    {fileAtts.length > 0 && (
                      <div className="flex max-w-full flex-col gap-1.5">
                        {fileAtts.map((a) => (
                          <AttachmentBubble
                            key={a.id}
                            attachment={a}
                            mine={mine}
                            onOpenImage={openImage}
                            menu={
                              <FileCaretMenu
                                onReact={(emoji) => react(m.id, emoji)}
                                onReply={() => handleReply(m.id)}
                                onCopy={() => handleCopy(m.body)}
                                onDelete={() => handleDelete(m.id)}
                              />
                            }
                          />
                        ))}
                      </div>
                    )}
                    {m.reactions.length > 0 && (
                      <div className={cn("flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
                        {m.reactions.map((r) => {
                          const mineReacted = r.memberIds.includes(currentMemberId);
                          return (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => react(m.id, r.emoji)}
                              className={cn(
                                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors",
                                mineReacted
                                  ? "border-primary/50 bg-primary/15 text-foreground"
                                  : "border-border/60 bg-surface/60 text-muted-foreground hover:bg-surface",
                              )}
                            >
                              <span>{r.emoji}</span>
                              <span className="text-[10px] font-medium">{r.memberIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {outbox.map((o) => (
            <OutboxBubble
              key={o.tempId}
              entry={o}
              uploadById={uploadById}
              onRetry={() => retryOutbox(o.tempId)}
              onDiscard={() => discardOutbox(o.tempId)}
            />
          ))}
          {messages.length === 0 && outbox.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No messages yet. Say hi!
            </div>
          )}
          {typingLabel && (
            <div className="flex items-end gap-2">
              <div className="w-8 shrink-0" />
              <div className="flex flex-col gap-1">
                <div className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-center gap-1" aria-label={typingLabel}>
                    <span className="size-1.5 animate-[typing_1.4s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.32s]" />
                    <span className="size-1.5 animate-[typing_1.4s_ease-in-out_infinite] rounded-full bg-primary [animation-delay:-0.16s]" />
                    <span className="size-1.5 animate-[typing_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
                  </div>
                </div>
                <span className="px-1 text-tiny text-muted-foreground">{typingLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/60 p-3">
        <div className="mx-auto max-w-3xl">
          {replyingTo && (
            <div className="mb-2 flex items-start gap-2 rounded-t-2xl border border-b-0 border-border/60 bg-surface/60 px-3 py-2">
              <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-primary">
                  Replying to {replyingTo.authorId === currentMemberId ? "yourself" : replyingTo.authorName}
                </div>
                <div className="line-clamp-1 text-xs text-muted-foreground">
                  {replyingTo.body || "Attachment"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 text-xs"
                >
                  {p.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="max-w-40 truncate">{p.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePending(p.key)}
                    aria-label="Remove"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-surface/40 p-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Attach"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
                if (e.key === "Escape" && replyTo) {
                  e.preventDefault();
                  setReplyTo(null);
                }
              }}
              placeholder={replyingTo ? "Reply…" : `Message ${title}`}
              className="min-h-10 flex-1 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              size="icon"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={send}
              disabled={!draft.trim() && pending.length === 0}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {lb.state && (
        <Lightbox
          images={lb.state.images}
          index={lb.state.index}
          onClose={lb.close}
          onIndex={lb.setIndex}
          renderMenu={(att) => {
            const msg = msgByAttachmentId.get(att.id);
            if (!msg) return null;
            return (
              <ImageActionsMenu
                onReact={(emoji) => react(msg.id, emoji)}
                onReply={() => {
                  lb.close();
                  handleReply(msg.id);
                }}
                onCopy={() => handleCopy(msg.body)}
                onDelete={() => {
                  lb.close();
                  handleDelete(msg.id);
                }}
              />
            );
          }}
        />
      )}
      {searchOpen && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-80 flex-col border-l border-border/60 bg-background shadow-xl">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">Search messages</span>
          </div>
          <div className="shrink-0 border-b border-border/60 px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}
                placeholder="Search"
                className="h-10 rounded-full pl-9 pr-9 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!sq && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Search for messages in this conversation.
              </div>
            )}
            {sq && searchMatches && searchMatches.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No messages found.
              </div>
            )}
            {sq && searchMatches && searchMatches.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                  {searchMatches.length} result{searchMatches.length === 1 ? "" : "s"}
                </div>
                <ul className="flex flex-col">
                  {searchMatches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => scrollToMessage(m.id)}
                        className="flex w-full flex-col gap-1 border-b border-border/40 px-4 py-3 text-left hover:bg-surface/60"
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                        <span className="line-clamp-2 text-sm text-foreground">
                          <span className="text-muted-foreground">{m.authorName}:</span>{" "}
                          {m.body}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      {view === "files" && (
        <div className="absolute inset-y-0 right-0 z-30 flex w-80 flex-col bg-background shadow-xl">
          <FilesPanel
            messages={messages.filter((m) => m.attachments.length > 0)}
            onClose={() => setView("chat")}
          />
        </div>
      )}
    </div>
  );
}

// An optimistically-sent message still uploading/delivering, rendered as a
// "mine" bubble with per-file progress — the WhatsApp send experience.
function OutboxBubble({
  entry,
  uploadById,
  onRetry,
  onDiscard,
}: {
  entry: OutboxEntry;
  uploadById: Map<string, UploadItem>;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = entry.status === "error";

  return (
    <div className="flex justify-end gap-2">
      <div className="flex max-w-[70%] flex-col items-end gap-1">
        {entry.files.length > 0 && (
          <div className="flex max-w-full flex-col gap-1.5">
            {entry.files.map((f) => {
              const item = uploadById.get(f.uploadId);
              const pct = item?.status === "done" ? 100 : (item?.progress ?? 0);
              const isImage = Boolean(
                f.contentType?.startsWith("image/") && f.previewUrl,
              );
              if (isImage) {
                return (
                  <div
                    key={f.uploadId}
                    className="relative overflow-hidden rounded-xl border border-border/50 bg-surface"
                    style={{ maxWidth: 240 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.previewUrl!}
                      alt={f.name}
                      className="max-h-60 w-auto max-w-[240px] object-cover"
                    />
                    {!failed && entry.status === "uploading" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                        <span className="text-xs font-semibold text-white">
                          {pct}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div
                  key={f.uploadId}
                  className="flex items-center gap-2.5 rounded-xl border border-primary-foreground/20 bg-primary/80 px-3 py-2 text-sm text-primary-foreground"
                >
                  {entry.status === "uploading" && !failed ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 opacity-80" />
                  )}
                  <span className="max-w-[200px] truncate font-medium">
                    {f.name}
                  </span>
                  {entry.status === "uploading" && !failed && (
                    <span className="shrink-0 text-[10px] opacity-80">{pct}%</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {entry.body && (
          <div className="flex max-w-full items-end gap-2 rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground opacity-90">
            <span className="whitespace-pre-wrap break-words">{entry.body}</span>
            <Clock className="ml-1 h-3 w-3 shrink-0 translate-y-0.5 opacity-70" />
          </div>
        )}
        {failed ? (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Failed to send</span>
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Discard
            </button>
          </div>
        ) : (
          <div className="px-1 text-[10px] text-muted-foreground">
            {entry.status === "uploading" ? "Uploading…" : "Sending…"}
          </div>
        )}
      </div>
    </div>
  );
}

type MessageActionHandlers = {
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
};

function ActionsMenuContent({ onReact, onReply, onCopy, onDelete }: MessageActionHandlers) {
  return (
    <DropdownMenuContent align="end" className="w-52 p-1" sideOffset={4} collisionPadding={8}>
      <div className="flex items-center gap-0.5 px-1 py-1">
        {QUICK_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onReact(e)}
            className="grid size-8 place-items-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-surface"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onReply}>
        <Reply className="h-4 w-4" />
        <span className="flex-1">Reply</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onCopy}>
        <Copy className="h-4 w-4" />
        <span className="flex-1">Copy</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onReply}>
        <Forward className="h-4 w-4" />
        <span className="flex-1">Forward</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Pin className="h-4 w-4" />
        <span className="flex-1">Pin</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Star className="h-4 w-4" />
        <span className="flex-1">Star</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
        <Trash2 className="h-4 w-4" />
        <span className="flex-1">Delete</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function MessageCaret({
  mine,
  ...handlers
}: { mine: boolean } & MessageActionHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute top-1 grid size-6 place-items-center rounded-full opacity-0 shadow-sm backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
            mine
              ? "right-1 bg-primary/70 text-primary-foreground hover:bg-primary/90"
              : "right-1 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground",
          )}
          aria-label="Message actions"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <ActionsMenuContent {...handlers} />
    </DropdownMenu>
  );
}

// Caret button overlaid on file cards, appears on hover (Lovable style).
function FileCaretMenu(handlers: MessageActionHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="grid size-7 place-items-center rounded-full bg-surface-2 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label="Message actions"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <ActionsMenuContent {...handlers} />
    </DropdownMenu>
  );
}

// ⋮ button overlaid on image tiles and in the lightbox header (Lovable style).
function ImageActionsMenu(handlers: MessageActionHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          aria-label="Message actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <ActionsMenuContent {...handlers} />
    </DropdownMenu>
  );
}

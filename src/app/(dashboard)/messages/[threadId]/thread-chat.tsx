"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X, FileText, Loader2, UploadCloud, SmilePlus, Search, Files as FilesIcon, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  sendMessage,
  uploadMessageAttachment,
  toggleReaction,
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

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "✅", "👀"];

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: MessageAttachment[];
  reactions: ReactionSummary[];
};

type PendingAttachment = {
  tempId: string;
  name: string;
  uploading: boolean;
  attachment?: MessageAttachment;
  error?: boolean;
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

export function ThreadChat({
  channel,
  presenceChannel,
  target,
  title,
  subtitle,
  currentMemberId,
  messages: initialMessages,
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
  /** memberId -> display name, used to render "X is typing". */
  memberNames?: Record<string, string>;
  /** Other members to reflect online status for (DM peers). */
  peerMemberIds?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<"chat" | "files">("chat");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dragDepth = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const lb = useLightbox();

  const online = usePresence(presenceChannel);
  const { typing, notifyTyping } = useTyping(channel);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Live incoming messages + reaction updates.
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
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing.length]);

  const pickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toUpload = Array.from(files);
    for (const file of toUpload) {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPending((prev) => [
        ...prev,
        { tempId, name: file.name, uploading: true },
      ]);
      const fd = new FormData();
      fd.append("file", file);
      uploadMessageAttachment(fd).then((res) => {
        setPending((prev) =>
          prev.map((p) =>
            p.tempId === tempId
              ? res.ok
                ? { ...p, uploading: false, attachment: res.data }
                : { ...p, uploading: false, error: true }
              : p,
          ),
        );
      });
    }
  };

  const removePending = (tempId: string) =>
    setPending((prev) => prev.filter((p) => p.tempId !== tempId));

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

  const anyUploading = pending.some((p) => p.uploading);

  const send = () => {
    const text = draft.trim();
    const ready = pending.filter((p) => p.attachment).map((p) => p.attachment!);
    if (!text && ready.length === 0) return;
    if (anyUploading) return;
    setDraft("");
    setPending([]);
    startTransition(async () => {
      const res = await sendMessage({
        ...target,
        body: text,
        attachmentIds: ready.map((a) => a.id),
      });
      if (res.ok) {
        const m = res.data;
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
                },
              ],
        );
        router.refresh();
      }
    });
  };

  const react = (messageId: string, emoji: string) => {
    // Optimistic toggle of my own reaction; server broadcast reconciles.
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

  const openImage = (att: MessageAttachment) => lb.open(att, allImages);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
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
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((m, i) => {
            const mine = m.authorId === currentMemberId;
            const prev = messages[i - 1];
            const showAuthor = !mine && (!prev || prev.authorId !== m.authorId);
            const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);

            return (
              <div key={m.id} id={`msg-${m.id}`} className={cn("contents", sq && matchIds && !matchIds.has(m.id) && "opacity-30")}>
                {showDay && (
                  <div className="my-2 flex items-center justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-tiny font-medium text-muted-foreground">
                      {formatDay(m.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "group flex items-center gap-2",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  {!mine && (
                    <div className="w-8 shrink-0 self-end">
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
                  {mine && (
                    <ReactTrigger onPick={(e) => react(m.id, e)} side="left" />
                  )}
                  <div
                    className={cn(
                      "flex max-w-[70%] flex-col gap-1",
                      mine && "items-end",
                    )}
                  >
                    {showAuthor && (
                      <div className="px-1 text-tiny text-muted-foreground">
                        {m.authorName}
                      </div>
                    )}
                    {m.attachments.length > 0 && (
                      <div className="flex max-w-full flex-col gap-1.5">
                        {m.attachments.map((a) => (
                          <AttachmentBubble key={a.id} attachment={a} mine={mine} onOpenImage={openImage} />
                        ))}
                      </div>
                    )}
                    {m.body && (
                      <div
                        className={cn(
                          "flex max-w-full items-end gap-2 rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          mine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-surface text-foreground",
                        )}
                      >
                        <span className="whitespace-pre-wrap break-words">
                          {m.body}
                        </span>
                        <span
                          className={cn(
                            "ml-1.5 shrink-0 translate-y-1 text-[9px] leading-none",
                            mine
                              ? "text-primary-foreground/60"
                              : "text-muted-foreground/70",
                          )}
                        >
                          {formatTime(m.createdAt)}
                        </span>
                      </div>
                    )}
                    {m.reactions.length > 0 && (
                      <div
                        className={cn(
                          "flex flex-wrap gap-1",
                          mine ? "justify-end" : "justify-start",
                        )}
                      >
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
                              <span className="text-[10px] font-medium">
                                {r.memberIds.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {!mine && (
                    <ReactTrigger onPick={(e) => react(m.id, e)} side="right" />
                  )}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No messages yet. Say hi!
            </div>
          )}
          {typingLabel && (
            <div className="px-1 text-tiny italic text-muted-foreground">
              {typingLabel}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/60 p-3">
        <div className="mx-auto max-w-3xl">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((p) => (
                <div
                  key={p.tempId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 text-xs",
                    p.error && "border-destructive/50 text-destructive",
                  )}
                >
                  {p.uploading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="max-w-40 truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removePending(p.tempId)}
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
            }}
            placeholder={`Message ${title}`}
            className="min-h-10 flex-1 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
            <Button
              size="icon"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={send}
              disabled={(!draft.trim() && pending.length === 0) || anyUploading}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {lb.state && (
        <Lightbox images={lb.state.images} index={lb.state.index} onClose={lb.close} onIndex={lb.setIndex} />
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

function ReactTrigger({
  onPick,
  side,
}: {
  onPick: (emoji: string) => void;
  side: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add reaction"
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-50 transition-opacity hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 data-[state=open]:opacity-100",
            side === "left" ? "order-first" : "order-last",
          )}
        >
          <SmilePlus className="h-icon-sm w-icon-sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="flex w-auto gap-0.5 rounded-full p-1"
      >
        {QUICK_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              onPick(e);
              setOpen(false);
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-muted"
          >
            {e}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}


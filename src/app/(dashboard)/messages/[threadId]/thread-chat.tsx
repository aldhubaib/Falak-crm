"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sendMessage, type MessageDTO } from "@/actions/messages";
import { useChannel, usePresence, useTyping } from "@/components/realtime/hooks";

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
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
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const online = usePresence(presenceChannel);
  const { typing, notifyTyping } = useTyping(channel);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Live incoming messages.
  useChannel(channel, (data) => {
    const d = data as { type?: string; message?: MessageDTO } | null;
    if (!d || d.type !== "message.new" || !d.message) return;
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
        },
      ];
    });
  });

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      const res = await sendMessage({ ...target, body: text });
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
                },
              ],
        );
      }
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Thread header */}
      <div className="flex h-14 items-center gap-3 border-b border-border/60 px-4">
        <div className="min-w-0">
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
              <div key={m.id} className="contents">
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
                  )}
                >
                  {!mine && (
                    <div className="w-8 shrink-0">
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
                          "ml-1 shrink-0 translate-y-0.5 text-xxs leading-none",
                          mine
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
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
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/60 bg-surface/40 p-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Attach"
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
            disabled={!draft.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

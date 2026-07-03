"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addTaskComment } from "@/actions/comments";

type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
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
  const diff = Math.round(
    (today.getTime() - d.getTime()) / 86400000,
  );
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
  taskId,
  projectId,
  taskTitle,
  projectName,
  currentMemberId,
  comments,
}: {
  taskId: string;
  projectId: string;
  taskTitle: string;
  projectName: string;
  currentMemberId: string;
  comments: Comment[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      await addTaskComment(taskId, text, projectId);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Thread header */}
      <div className="flex h-14 items-center gap-3 border-b border-border/60 px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{taskTitle}</div>
          <div className="truncate text-xs text-muted-foreground">
            {projectName}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {comments.map((m, i) => {
            const mine = m.authorId === currentMemberId;
            const prev = comments[i - 1];
            const showAuthor =
              !mine && (!prev || prev.authorId !== m.authorId);
            const showDay =
              !prev || !sameDay(prev.createdAt, m.createdAt);

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
          {comments.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No messages yet. Say hi!
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${taskTitle}`}
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

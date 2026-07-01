"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { addTaskComment, getTaskComments, getWorkspaceMembers } from "@/actions/comments";
import { Send, Loader2, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Member = { id: string; userId: string; name: string | null; email: string };
type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  author: Member;
};

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

function renderCommentBody(body: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(MENTION_RE);

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-primary font-medium">
        @{match[1]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts;
}

function getInitials(name: string | null, email: string) {
  if (name) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function TaskComments({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const [c, m] = await Promise.all([
      getTaskComments(taskId),
      getWorkspaceMembers(),
    ]);
    setComments(c.map((x) => ({ ...x, createdAt: new Date(x.createdAt) })));
    setMembers(m);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const filteredMembers = members.filter((m) => {
    const search = mentionFilter.toLowerCase();
    return (
      (m.name?.toLowerCase().includes(search) ?? false) ||
      m.email.toLowerCase().includes(search)
    );
  });

  const handleInput = (value: string, selectionStart: number) => {
    setBody(value);
    setCursorPos(selectionStart);

    const textBeforeCursor = value.slice(0, selectionStart);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member: Member) => {
    const textBeforeCursor = body.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (!mentionMatch) return;

    const start = cursorPos - mentionMatch[0].length;
    const displayName = member.name || member.email;
    const mentionText = `@[${displayName}](${member.id}) `;
    const newBody = body.slice(0, start) + mentionText + body.slice(cursorPos);

    setBody(newBody);
    setShowMentions(false);

    setTimeout(() => {
      if (inputRef.current) {
        const newPos = start + mentionText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const result = await addTaskComment(taskId, body.trim(), projectId);
    if (result.ok) {
      setBody("");
      await loadData();
    }
    setSending(false);
  };

  const getDisplayBody = (text: string) => {
    return text.replace(MENTION_RE, "@$1");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-icon-md h-icon-md animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-label font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        Comments
        {comments.length > 0 && (
          <span className="text-label bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">
            {comments.length}
          </span>
        )}
      </h3>

      {comments.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-icon-btn h-icon-btn rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-label font-bold text-primary">
                  {getInitials(comment.author.name, comment.author.email)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-secondary font-medium text-foreground">
                    {comment.author.name || comment.author.email}
                  </span>
                  <span className="text-label text-muted-foreground/60">
                    {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-body text-foreground/80 mt-0.5 whitespace-pre-wrap break-words">
                  {renderCommentBody(comment.body)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="relative">
        {showMentions && filteredMembers.length > 0 && (
          <div
            ref={mentionListRef}
            className="absolute bottom-full mb-1 left-0 w-64 bg-black border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            {filteredMembers.slice(0, 6).map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m)}
                className={`w-full text-left px-3 py-2 text-body flex items-center gap-2 transition-colors ${
                  i === mentionIndex ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="w-icon-btn h-icon-btn rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-label font-bold text-primary">
                    {getInitials(m.name, m.email)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-secondary">{m.name || m.email}</div>
                  {m.name && <div className="truncate text-label text-muted-foreground/60">{m.email}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-card border border-border rounded-xl p-2">
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                const pos = inputRef.current.selectionStart || body.length;
                const newBody = body.slice(0, pos) + "@" + body.slice(pos);
                setBody(newBody);
                handleInput(newBody, pos + 1);
                inputRef.current.focus();
              }
            }}
            className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors shrink-0"
          >
            <AtSign className="w-icon-md h-icon-md" />
          </button>
          <textarea
            ref={inputRef}
            value={getDisplayBody(body)}
            onChange={(e) => {
              const rawValue = e.target.value;
              const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
              let reconstructed = rawValue;

              const existingMentions: { name: string; id: string }[] = [];
              let m;
              while ((m = mentionPattern.exec(body)) !== null) {
                existingMentions.push({ name: m[1], id: m[2] });
              }

              for (const mention of existingMentions) {
                const display = `@${mention.name}`;
                const full = `@[${mention.name}](${mention.id})`;
                reconstructed = reconstructed.replace(display, full);
              }

              handleInput(reconstructed, e.target.selectionStart || 0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment... Use @ to mention"
            rows={1}
            className="flex-1 bg-transparent text-body text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none py-1.5 max-h-32"
            style={{ minHeight: "32px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="w-icon-btn h-icon-btn rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? (
              <Loader2 className="w-icon-sm h-icon-sm animate-spin" />
            ) : (
              <Send className="w-icon-sm h-icon-sm" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

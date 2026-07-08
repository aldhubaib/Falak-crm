"use server";

import { db } from "@/lib/db";
import {
  requireWorkspaceWithMember,
  getProjectAccess,
  getAccessibleProjectScope,
} from "@/lib/workspace";
import { safeAction, type ActionResult } from "@/lib/action";
import { canEdit } from "@/lib/permissions";
import { isArchivedStatus } from "@/lib/utils";
import { sendNotification } from "@/lib/push";
import { createPresignedGet } from "@/lib/storage";
import {
  broadcast,
  taskChannel,
  projectChannel,
  conversationChannel,
  userChannel,
} from "@/lib/centrifugo";

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

function parseMentions(body: string): string[] {
  const ids = new Set<string>();
  let match;
  while ((match = MENTION_RE.exec(body)) !== null) {
    ids.add(match[2]);
  }
  return [...ids];
}

/** Strip mention markup down to plain "@Name" for display/previews. */
function toDisplayBody(body: string): string {
  return body.replace(MENTION_RE, "@$1");
}

/** Names mentioned in a body — the client highlights "@Name" runs as chips. */
function parseMentionNames(body: string): string[] {
  const names = new Set<string>();
  let match;
  while ((match = MENTION_RE.exec(body)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/** Task summary rendered as a reference card on chat bubbles. */
export type MessageTaskRef = {
  id: string;
  projectId: string;
  number: number;
  title: string;
};

export type MessageAttachment = {
  id: string;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  isImage: boolean;
};

// A message's reactions grouped by emoji. Each client derives count + "mine"
// from memberIds against the current viewer.
export type ReactionSummary = { emoji: string; memberIds: string[] };

// Server-side allowlist of reaction emojis so arbitrary strings can't be stored.
const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "✅", "👀"];

export type MessageDTO = {
  id: string;
  taskId: string | null;
  projectId: string | null;
  conversationId: string | null;
  kind: string;
  authorId: string;
  authorName: string;
  authorImageUrl: string | null;
  body: string;
  createdAt: string;
  attachments: MessageAttachment[];
  replyToId?: string | null;
  task?: MessageTaskRef | null;
  mentions?: string[];
};

type SendMessageInput = {
  body: string;
  taskId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  kind?: string;
  attachmentIds?: string[];
  replyToId?: string;
};

// ─── Thread messages (paginated) ─────────────────────────────────────────────

const THREAD_PAGE_SIZE = 50;

export type ThreadMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorImageUrl: string | null;
  body: string;
  createdAt: string;
  replyToId: string | null;
  attachments: MessageAttachment[];
  reactions: ReactionSummary[];
  kind: string;
  /** Set when the message is a task comment surfacing in a project channel. */
  task: MessageTaskRef | null;
  /** Display names mentioned in the body, for @chip highlighting. */
  mentions: string[];
};

export type ThreadMessagesPage = {
  messages: ThreadMessage[]; // oldest → newest
  hasMore: boolean; // older messages exist before the first one returned
};

// Loads one page of a thread's messages, newest-first window rendered oldest →
// newest. Pass `cursorId` (the id of the oldest loaded message) to fetch the
// previous page. Threads used to load their full history in one query, which
// made busy chats slower with every message ever sent.
export async function getThreadMessages(input: {
  taskId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  cursorId?: string;
}): Promise<ThreadMessagesPage> {
  const { workspace, member } = await requireWorkspaceWithMember();

  let where: { taskId?: string; projectId?: string; conversationId?: string };
  if (input.conversationId) {
    const convo = await db.conversation.findFirst({
      where: {
        id: input.conversationId,
        workspaceId: workspace.id,
        participants: { some: { memberId: member.id } },
      },
      select: { id: true },
    });
    if (!convo) throw new Error("Permission denied");
    where = { conversationId: input.conversationId };
  } else if (input.taskId) {
    const task = await db.task.findFirst({
      where: { id: input.taskId, project: { workspaceId: workspace.id } },
      select: { projectId: true },
    });
    if (!task) throw new Error("Not found");
    const access = await getProjectAccess(task.projectId);
    if (!access.hasAccess) throw new Error("Permission denied");
    where = { taskId: input.taskId };
  } else if (input.projectId) {
    const access = await getProjectAccess(input.projectId);
    if (!access.hasAccess) throw new Error("Permission denied");
    where = { projectId: input.projectId };
  } else {
    throw new Error("No thread specified");
  }

  const rows = await db.message.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: { select: { emoji: true, memberId: true }, orderBy: { createdAt: "asc" } },
      task: { select: { id: true, taskNumber: true, title: true, projectId: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: THREAD_PAGE_SIZE + 1,
    ...(input.cursorId ? { cursor: { id: input.cursorId }, skip: 1 } : {}),
  });

  const hasMore = rows.length > THREAD_PAGE_SIZE;
  const page = rows.slice(0, THREAD_PAGE_SIZE).reverse();

  const attachmentRows =
    page.length > 0
      ? await db.attachment.findMany({
          where: {
            workspaceId: workspace.id,
            entityType: "message",
            entityId: { in: page.map((r) => r.id) },
            status: "uploaded",
          },
          select: { id: true, name: true, contentType: true, sizeBytes: true, entityId: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const attachmentsByMessage = new Map<string, typeof attachmentRows>();
  for (const a of attachmentRows) {
    const list = attachmentsByMessage.get(a.entityId) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.entityId, list);
  }

  const messages: ThreadMessage[] = page.map((c) => {
    const byEmoji = new Map<string, string[]>();
    for (const r of c.reactions) {
      const list = byEmoji.get(r.emoji) ?? [];
      list.push(r.memberId);
      byEmoji.set(r.emoji, list);
    }
    return {
      id: c.id,
      authorId: c.authorId,
      authorName: c.author.name ?? c.author.email,
      authorImageUrl: c.author.imageUrl ?? null,
      body: toDisplayBody(c.body),
      createdAt: c.createdAt.toISOString(),
      replyToId: c.replyToId ?? null,
      attachments: (attachmentsByMessage.get(c.id) ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        isImage: isImageType(a.contentType),
      })),
      reactions: [...byEmoji.entries()].map(([emoji, memberIds]) => ({ emoji, memberIds })),
      kind: c.kind,
      task: c.task
        ? {
            id: c.task.id,
            projectId: c.task.projectId,
            number: c.task.taskNumber,
            title: c.task.title,
          }
        : null,
      mentions: parseMentionNames(c.body),
    };
  });

  return { messages, hasMore };
}

// ─── Task references (# picker in project channels) ─────────────────────────

export type TaskPickerItem = {
  id: string;
  number: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
};

// Task list for the composer's "#" autocomplete in project channels. Loaded
// lazily the first time the member types "#".
export async function getProjectTaskRefs(
  projectId: string,
): Promise<TaskPickerItem[]> {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");

  const tasks = await db.task.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { taskNumber: "desc" },
    take: 100,
    select: {
      id: true,
      taskNumber: true,
      title: true,
      status: { select: { name: true, color: true } },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    number: t.taskNumber,
    title: t.title,
    statusName: t.status?.name ?? null,
    statusColor: t.status?.color ?? null,
  }));
}

// Chat attachments upload directly to R2 through the client upload manager
// (multipart + resume, see src/lib/upload-manager.ts). No server action buffers
// file bytes in memory anymore.

function isImageType(contentType: string | null): boolean {
  return Boolean(contentType && contentType.startsWith("image/"));
}

// Single write path for every message surface: task comments, rejections,
// project chat, and direct messages. Persists to Postgres (source of truth),
// notifies (mention-driven), and publishes live via Centrifugo.
export async function sendMessage(
  input: SendMessageInput,
): Promise<ActionResult<MessageDTO>> {
  return safeAction("Send Message", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();

    const body = input.body.trim();
    const attachmentIds = [...new Set(input.attachmentIds ?? [])];
    if (!body && attachmentIds.length === 0) {
      throw new Error("Message is empty");
    }

    let taskId = input.taskId ?? null;
    let projectId = input.projectId ?? null;
    const conversationId = input.conversationId ?? null;
    let taskTitle = "";
    let taskNumber = 0;
    let projectName = "";
    let projectThumbnailId: string | null = null;
    let participantIds: string[] = [];

    // Direct messages and project channels are governed by the Chat module —
    // "view" members read but cannot send. Task comments stay governed by
    // project/task permissions below.
    if ((conversationId || (projectId && !taskId)) && !canEdit(member, "chat")) {
      throw new Error("You have read-only access to chat");
    }

    if (conversationId) {
      const convo = await db.conversation.findFirst({
        where: {
          id: conversationId,
          workspaceId: workspace.id,
          participants: { some: { memberId: member.id } },
        },
        include: { participants: { select: { memberId: true } } },
      });
      if (!convo) throw new Error("Conversation not found");
      participantIds = convo.participants.map((p) => p.memberId);
      taskId = null;
      projectId = null;
    } else if (taskId) {
      const task = await db.task.findFirst({
        where: { id: taskId },
        select: {
          id: true,
          title: true,
          taskNumber: true,
          projectId: true,
          project: { select: { name: true, thumbnailId: true } },
        },
      });
      if (!task) throw new Error("Task not found");
      const access = await getProjectAccess(task.projectId);
      if (!access.hasAccess) throw new Error("Permission denied");
      projectId = task.projectId;
      taskTitle = task.title;
      taskNumber = task.taskNumber;
      projectName = task.project.name;
      projectThumbnailId = task.project.thumbnailId;
    } else if (projectId) {
      const access = await getProjectAccess(projectId);
      if (!access.hasAccess) throw new Error("Permission denied");
      const project = await db.project.findFirst({
        where: { id: projectId, workspaceId: workspace.id },
        select: { name: true, thumbnailId: true, status: { select: { name: true } } },
      });
      if (isArchivedStatus(project?.status?.name)) {
        throw new Error("This project is archived — the channel is read-only");
      }
      projectName = project?.name ?? "";
      projectThumbnailId = project?.thumbnailId ?? null;
    } else {
      throw new Error("No thread specified");
    }

    let mentionedIds = parseMentions(body);

    // "@all" fans out to the whole thread audience — the project's team plus
    // workspace owners (the same list the composer's @ picker offers). DMs
    // already notify every participant, so there "all" is just stripped.
    if (mentionedIds.includes("all")) {
      mentionedIds = mentionedIds.filter((id) => id !== "all");
      if (projectId) {
        const [projectMembers, owners] = await Promise.all([
          db.projectMember.findMany({
            where: { projectId },
            select: { memberId: true },
          }),
          db.workspaceMember.findMany({
            where: { workspaceId: workspace.id, type: "OWNER" },
            select: { id: true },
          }),
        ]);
        const everyone = new Set([
          ...mentionedIds,
          ...projectMembers.map((m) => m.memberId),
          ...owners.map((o) => o.id),
        ]);
        everyone.delete(member.id);
        mentionedIds = [...everyone];
      }
    }

    const message = await db.message.create({
      data: {
        taskId,
        projectId,
        conversationId,
        replyToId: input.replyToId ?? null,
        authorId: member.id,
        body,
        kind: input.kind ?? "message",
        mentions: mentionedIds.length
          ? { create: mentionedIds.map((id) => ({ memberId: id })) }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true, imageUrl: true } },
      },
    });

    // Link any pre-uploaded attachments to this message.
    let attachments: MessageAttachment[] = [];
    if (attachmentIds.length > 0) {
      await db.attachment.updateMany({
        where: {
          id: { in: attachmentIds },
          workspaceId: workspace.id,
          entityType: { in: ["message_pending", "message_attachment"] },
        },
        data: { entityType: "message", entityId: message.id },
      });
      const rows = await db.attachment.findMany({
        where: { entityType: "message", entityId: message.id },
        select: { id: true, name: true, contentType: true, sizeBytes: true },
      });
      attachments = rows.map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        isImage: isImageType(a.contentType),
      }));
    }

    const authorName =
      message.author.name ?? message.author.email ?? "Someone";
    const display = toDisplayBody(body);
    const previewText = display || (attachments.length > 0 ? `📎 ${attachments[0].name}` : "");
    const preview =
      previewText.length > 80 ? previewText.slice(0, 80) + "…" : previewText;

    const dto: MessageDTO = {
      id: message.id,
      taskId,
      projectId,
      conversationId,
      kind: message.kind,
      authorId: member.id,
      authorName,
      authorImageUrl: message.author.imageUrl ?? null,
      body: display,
      createdAt: message.createdAt.toISOString(),
      attachments,
      replyToId: input.replyToId ?? null,
      task:
        taskId && projectId
          ? { id: taskId, projectId, number: taskNumber, title: taskTitle }
          : null,
      mentions: parseMentionNames(body),
    };

    // Recipients + notification (mention-driven; DMs notify all participants).
    let url: string;
    let threadId: string;
    let recipients: string[];
    if (conversationId) {
      url = `/messages/conv-${conversationId}`;
      threadId = `conv-${conversationId}`;
      recipients = participantIds.filter((id) => id !== member.id);
    } else if (taskId) {
      url = `/projects/${projectId}/tasks/${taskId}`;
      threadId = `task-${taskId}`;
      recipients = mentionedIds.filter((id) => id !== member.id);
    } else {
      url = `/messages/project-${projectId}`;
      threadId = `project-${projectId}`;
      recipients = mentionedIds.filter((id) => id !== member.id);
    }

    const notifyType =
      input.kind === "rejection"
        ? "rejection"
        : conversationId
          ? "message"
          : "mention";

    const title = conversationId
      ? authorName
      : input.kind === "rejection"
        ? `${authorName} declined "${taskTitle}"`
        : `${authorName} mentioned you${taskTitle ? ` in "${taskTitle}"` : projectName ? ` in ${projectName}` : ""}`;

    // Notification icon: project thumbnail for project/task threads, otherwise
    // the sender's profile photo. Thumbnails live in R2, so mint a presigned
    // URL the OS can fetch when it displays the notification.
    let notifyIcon = message.author.imageUrl ?? undefined;
    if (!conversationId && projectThumbnailId) {
      try {
        const thumb = await db.attachment.findUnique({
          where: { id: projectThumbnailId },
          select: { r2Key: true },
        });
        if (thumb?.r2Key) notifyIcon = await createPresignedGet(thumb.r2Key);
      } catch {
        // fall back to the author's photo
      }
    }

    for (const rid of new Set(recipients)) {
      void sendNotification({
        recipientId: rid,
        type: notifyType,
        title,
        body: preview,
        url,
        tag: `msg-${message.id}`,
        icon: notifyIcon,
      });
    }

    // Live delivery: thread channels for open views, user channels for inbox.
    const threadChannels: string[] = [];
    if (taskId) threadChannels.push(taskChannel(taskId));
    if (projectId) threadChannels.push(projectChannel(projectId));
    if (conversationId) threadChannels.push(conversationChannel(conversationId));
    void broadcast(threadChannels, { type: "message.new", message: dto });

    const inboxTargets = conversationId ? participantIds : [...recipients, member.id];
    void broadcast(
      [...new Set(inboxTargets)].map(userChannel),
      { type: "inbox", threadId, projectId, taskId, conversationId },
    );

    return dto;
  });
}

// Toggle the current member's reaction on a message. Returns the full grouped
// reaction summary and publishes it live to the message's thread channel(s).
export async function toggleReaction(
  messageId: string,
  emoji: string,
): Promise<ActionResult<{ messageId: string; reactions: ReactionSummary[] }>> {
  return safeAction("React", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();

    if (!ALLOWED_EMOJIS.includes(emoji)) throw new Error("Invalid reaction");

    const message = await db.message.findFirst({
      where: { id: messageId },
      select: { id: true, taskId: true, projectId: true, conversationId: true },
    });
    if (!message) throw new Error("Message not found");

    // Access check mirrors sendMessage's thread resolution.
    if (message.conversationId) {
      const convo = await db.conversation.findFirst({
        where: {
          id: message.conversationId,
          workspaceId: workspace.id,
          participants: { some: { memberId: member.id } },
        },
        select: { id: true },
      });
      if (!convo) throw new Error("Permission denied");
    } else if (message.projectId) {
      const access = await getProjectAccess(message.projectId);
      if (!access.hasAccess) throw new Error("Permission denied");
    } else {
      throw new Error("Permission denied");
    }

    // Toggle: remove if it exists, otherwise add.
    const existing = await db.messageReaction.findUnique({
      where: {
        messageId_memberId_emoji: { messageId, memberId: member.id, emoji },
      },
      select: { id: true },
    });
    if (existing) {
      await db.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await db.messageReaction.create({
        data: { messageId, memberId: member.id, emoji },
      });
    }

    const all = await db.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, memberId: true },
      orderBy: { createdAt: "asc" },
    });
    const byEmoji = new Map<string, string[]>();
    for (const r of all) {
      const list = byEmoji.get(r.emoji) ?? [];
      list.push(r.memberId);
      byEmoji.set(r.emoji, list);
    }
    const reactions: ReactionSummary[] = [...byEmoji.entries()].map(
      ([e, memberIds]) => ({ emoji: e, memberIds }),
    );

    const channels: string[] = [];
    if (message.taskId) channels.push(taskChannel(message.taskId));
    if (message.projectId) channels.push(projectChannel(message.projectId));
    if (message.conversationId)
      channels.push(conversationChannel(message.conversationId));
    void broadcast(channels, {
      type: "reaction.updated",
      messageId,
      reactions,
    });

    return { messageId, reactions };
  });
}

export async function deleteMessage(
  messageId: string,
): Promise<ActionResult<void>> {
  return safeAction("Delete message", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();

    const message = await db.message.findFirst({
      where: { id: messageId },
      select: { id: true, authorId: true, conversationId: true, projectId: true, taskId: true },
    });
    if (!message) throw new Error("Message not found");
    if (message.authorId !== member.id) throw new Error("You can only delete your own messages");

    await db.message.delete({ where: { id: message.id } });

    const channels: string[] = [];
    if (message.taskId) channels.push(taskChannel(message.taskId));
    if (message.projectId) channels.push(projectChannel(message.projectId));
    if (message.conversationId)
      channels.push(conversationChannel(message.conversationId));
    void broadcast(channels, { type: "message.deleted", messageId: message.id });
  });
}

export type InboxThread = {
  id: string; // project-<id> | conv-<id>
  kind: "project" | "direct";
  name: string;
  subtitle: string;
  projectId: string | null;
  conversationId: string | null;
  thumbnailId: string | null;
  peerMemberIds: string[];
  lastMessage: string;
  lastAuthor: string;
  lastAt: string;
  unread: number;
  avatar: string;
  initials: string;
  /** 1:1 DMs: the other member's profile photo (photo beats initials). */
  imageUrl: string | null;
  /** Project threads only: true when the project status is anything but Active. */
  archived: boolean;
};

// Inbox = one "Everything feed" thread per accessible project (task comments +
// rejections + project chat all roll up here) plus one thread per direct
// conversation the member is in.
export async function getInboxThreads(): Promise<InboxThread[]> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const scope = await getAccessibleProjectScope();

  // Every accessible project appears in the inbox — including ones with an
  // empty chat — so newly invited members can find and start the conversation.
  const projectWhere =
    scope.all
      ? { workspaceId: workspace.id, deletedAt: null }
      : {
          workspaceId: workspace.id,
          deletedAt: null,
          id: { in: scope.projectIds ?? [] },
        };

  const [projects, conversations, unreadCounts] = await Promise.all([
    db.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        thumbnailId: true,
        status: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    db.conversation.findMany({
      where: {
        workspaceId: workspace.id,
        participants: { some: { memberId: member.id } },
      },
      include: {
        participants: {
          include: {
            member: {
              select: { id: true, name: true, email: true, imageUrl: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    db.notification.groupBy({
      by: ["linkUrl"],
      where: { recipientId: member.id, read: false, linkUrl: { not: null } },
      _count: true,
    }),
  ]);

  const unreadMap = new Map<string, number>();
  for (const row of unreadCounts) {
    if (row.linkUrl) unreadMap.set(row.linkUrl, row._count);
  }

  const projectThreads: InboxThread[] = projects.map((p) => {
    const last = p.messages[0];
    // Everything feed unread = project-feed notifications + any task-level
    // mention/rejection notifications within this project.
    let unread = unreadMap.get(`/messages/project-${p.id}`) ?? 0;
    const taskPrefix = `/projects/${p.id}/`;
    for (const [url, count] of unreadMap) {
      if (url.startsWith(taskPrefix)) unread += count;
    }
    return {
      id: `project-${p.id}`,
      kind: "project" as const,
      name: p.name,
      subtitle: "Project chat",
      projectId: p.id,
      conversationId: null,
      thumbnailId: p.thumbnailId ?? null,
      peerMemberIds: [],
      lastMessage: last ? toDisplayBody(last.body) || "📎 Attachment" : "",
      lastAuthor: last ? (last.author.name ?? last.author.email) : "",
      lastAt: last ? last.createdAt.toISOString() : "",
      unread,
      avatar: generateColor(p.name),
      initials: p.name.charAt(0).toUpperCase(),
      imageUrl: null,
      archived: isArchivedStatus(p.status?.name),
    };
  });

  const dmThreads: InboxThread[] = conversations
    .filter((c) => c.messages.length > 0 || c.isGroup)
    .map((c) => {
      const others = c.participants
        .map((pp) => pp.member)
        .filter((m) => m.id !== member.id);
      const name =
        c.title ??
        (others.map((m) => m.name ?? m.email).join(", ") || "Direct message");
      const last = c.messages[0];
      return {
        id: `conv-${c.id}`,
        kind: "direct" as const,
        name,
        subtitle: c.isGroup ? `${c.participants.length} members` : "Direct message",
        projectId: null,
        conversationId: c.id,
        thumbnailId: null,
        peerMemberIds: others.map((m) => m.id),
        lastMessage: last ? toDisplayBody(last.body) || "📎 Attachment" : "",
        lastAuthor: last ? (last.author.name ?? last.author.email) : "",
        lastAt: last ? last.createdAt.toISOString() : "",
        unread: unreadMap.get(`/messages/conv-${c.id}`) ?? 0,
        avatar: generateColor(name),
        initials: name.charAt(0).toUpperCase(),
        // 1:1 chats show the other person's photo; groups keep initials.
        imageUrl: !c.isGroup && others.length === 1 ? (others[0].imageUrl ?? null) : null,
        archived: false,
      };
    });

  // Most recent activity first; threads with no messages yet sink to the end.
  return [...projectThreads, ...dmThreads].sort((a, b) => {
    const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
    const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
    return tb - ta;
  });
}

// ─── Direct conversations ─────────────────────────────────────────────────────

export async function getOrCreateDirectConversation(
  otherMemberId: string,
): Promise<ActionResult<string>> {
  return safeAction("Open Conversation", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "chat")) throw new Error("You have read-only access to chat");
    if (otherMemberId === member.id) throw new Error("Cannot message yourself");

    const other = await db.workspaceMember.findFirst({
      where: { id: otherMemberId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!other) throw new Error("Member not found");

    // Find an existing 1:1 conversation containing exactly these two members.
    const existing = await db.conversation.findFirst({
      where: {
        workspaceId: workspace.id,
        isGroup: false,
        AND: [
          { participants: { some: { memberId: member.id } } },
          { participants: { some: { memberId: otherMemberId } } },
        ],
      },
      include: { _count: { select: { participants: true } } },
    });
    if (existing && existing._count.participants === 2) return existing.id;

    const convo = await db.conversation.create({
      data: {
        workspaceId: workspace.id,
        isGroup: false,
        participants: {
          create: [{ memberId: member.id }, { memberId: otherMemberId }],
        },
      },
    });
    return convo.id;
  });
}

export async function getMessageableMembers() {
  const { workspace, member } = await requireWorkspaceWithMember();
  return db.workspaceMember.findMany({
    where: { workspaceId: workspace.id, id: { not: member.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899",
  "#0ea5e9", "#a855f7", "#f97316", "#14b8a6",
];

function generateColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

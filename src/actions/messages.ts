"use server";

import { db } from "@/lib/db";
import {
  requireWorkspaceWithMember,
  getProjectAccess,
  getAccessibleProjectScope,
} from "@/lib/workspace";
import { safeAction, type ActionResult } from "@/lib/action";
import { sendNotification } from "@/lib/push";
import { uploadBytes, generateR2Key } from "@/lib/storage";
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

export type MessageAttachment = {
  id: string;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  isImage: boolean;
};

export type MessageDTO = {
  id: string;
  taskId: string | null;
  projectId: string | null;
  conversationId: string | null;
  kind: string;
  authorId: string;
  authorName: string;
  body: string; // display body (mentions collapsed to @Name)
  createdAt: string;
  attachments: MessageAttachment[];
};

type SendMessageInput = {
  body: string;
  taskId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  kind?: string;
  attachmentIds?: string[];
};

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function isImageType(contentType: string | null): boolean {
  return Boolean(contentType && contentType.startsWith("image/"));
}

// Uploads a chat attachment to R2 and returns a pending Attachment record. It is
// linked to its message when sendMessage runs with the returned id.
export async function uploadMessageAttachment(
  formData: FormData,
): Promise<ActionResult<MessageAttachment>> {
  return safeAction("Upload Attachment", async () => {
    const { workspace } = await requireWorkspaceWithMember();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("No file provided");
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error("File must be 25MB or smaller");
    }

    const name = file.name || "file";
    const key = generateR2Key("message_attachment", name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadBytes(bytes, key, file.type || "application/octet-stream");

    const attachment = await db.attachment.create({
      data: {
        workspaceId: workspace.id,
        entityType: "message_pending",
        entityId: "",
        name,
        sizeBytes: file.size,
        contentType: file.type || null,
        r2Key: key,
        status: "uploaded",
      },
    });

    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      isImage: isImageType(attachment.contentType),
    };
  });
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
    let projectName = "";
    let participantIds: string[] = [];

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
        select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
      });
      if (!task) throw new Error("Task not found");
      const access = await getProjectAccess(task.projectId);
      if (!access.hasAccess) throw new Error("Permission denied");
      projectId = task.projectId;
      taskTitle = task.title;
      projectName = task.project.name;
    } else if (projectId) {
      const access = await getProjectAccess(projectId);
      if (!access.hasAccess) throw new Error("Permission denied");
      const project = await db.project.findFirst({
        where: { id: projectId, workspaceId: workspace.id },
        select: { name: true },
      });
      projectName = project?.name ?? "";
    } else {
      throw new Error("No thread specified");
    }

    const mentionedIds = parseMentions(body);

    const message = await db.message.create({
      data: {
        taskId,
        projectId,
        conversationId,
        authorId: member.id,
        body,
        kind: input.kind ?? "message",
        mentions: mentionedIds.length
          ? { create: mentionedIds.map((id) => ({ memberId: id })) }
          : undefined,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    // Link any pre-uploaded attachments to this message.
    let attachments: MessageAttachment[] = [];
    if (attachmentIds.length > 0) {
      await db.attachment.updateMany({
        where: {
          id: { in: attachmentIds },
          workspaceId: workspace.id,
          entityType: "message_pending",
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
      body: display,
      createdAt: message.createdAt.toISOString(),
      attachments,
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

    for (const rid of new Set(recipients)) {
      void sendNotification({
        recipientId: rid,
        type: notifyType,
        title,
        body: preview,
        url,
        tag: `msg-${message.id}`,
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
};

// Inbox = one "Everything feed" thread per accessible project (task comments +
// rejections + project chat all roll up here) plus one thread per direct
// conversation the member is in.
export async function getInboxThreads(): Promise<InboxThread[]> {
  const { workspace, member } = await requireWorkspaceWithMember();
  const scope = await getAccessibleProjectScope();

  const projectWhere =
    scope.all
      ? { workspaceId: workspace.id, deletedAt: null, messages: { some: {} } }
      : {
          workspaceId: workspace.id,
          deletedAt: null,
          messages: { some: {} },
          id: { in: scope.projectIds ?? [] },
        };

  const [projects, conversations, unreadCounts] = await Promise.all([
    db.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        thumbnailId: true,
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
          include: { member: { select: { id: true, name: true, email: true } } },
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
      };
    });

  return [...projectThreads, ...dmThreads].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

// ─── Direct conversations ─────────────────────────────────────────────────────

export async function getOrCreateDirectConversation(
  otherMemberId: string,
): Promise<ActionResult<string>> {
  return safeAction("Open Conversation", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
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

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember, getProjectAccess } from "@/lib/workspace";
import {
  taskChannel,
  projectChannel,
  conversationChannel,
  workspacePresenceChannel,
} from "@/lib/channels";
import { ThreadChat, type ChatMessage, type ThreadTarget } from "./thread-chat";

const MENTION_RE = /@\[([^\]]+)\]\([^)]+\)/g;

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { workspace, member } = await requireWorkspaceWithMember();

  // Thread id encodes the kind: task-<id>, project-<id>, or conv-<id>.
  let target: ThreadTarget = {};
  let channel = "";
  let presenceChannel: string | null = null;
  let title = "";
  let subtitle = "";
  let peerMemberIds: string[] = [];
  const memberNames: Record<string, string> = {};
  let where: { taskId?: string; projectId?: string; conversationId?: string };

  if (threadId.startsWith("task-")) {
    const taskId = threadId.slice(5);
    const task = await db.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { workspaceId: workspace.id } },
      select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
    });
    if (!task) notFound();
    const access = await getProjectAccess(task.projectId);
    if (!access.hasAccess) notFound();
    target = { taskId: task.id, projectId: task.projectId };
    channel = taskChannel(task.id);
    presenceChannel = taskChannel(task.id);
    title = task.title;
    subtitle = task.project.name;
    where = { taskId: task.id };
  } else if (threadId.startsWith("project-")) {
    const projectId = threadId.slice(8);
    const access = await getProjectAccess(projectId);
    if (!access.hasAccess || !access.project) notFound();
    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
      select: { id: true, name: true },
    });
    if (!project) notFound();
    target = { projectId: project.id };
    channel = projectChannel(project.id);
    presenceChannel = projectChannel(project.id);
    title = project.name;
    subtitle = "Project chat";
    where = { projectId: project.id };
  } else if (threadId.startsWith("conv-")) {
    const conversationId = threadId.slice(5);
    const convo = await db.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId: workspace.id,
        participants: { some: { memberId: member.id } },
      },
      include: {
        participants: {
          include: { member: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!convo) notFound();
    const others = convo.participants
      .map((p) => p.member)
      .filter((m) => m.id !== member.id);
    for (const p of convo.participants) {
      memberNames[p.member.id] = p.member.name ?? p.member.email;
    }
    peerMemberIds = others.map((m) => m.id);
    target = { conversationId: convo.id };
    channel = conversationChannel(convo.id);
    presenceChannel = workspacePresenceChannel(workspace.id);
    title =
      convo.title ??
      (others.map((m) => m.name ?? m.email).join(", ") || "Direct message");
    subtitle = convo.isGroup ? `${convo.participants.length} members` : "Direct message";
    where = { conversationId: convo.id };
  } else {
    notFound();
  }

  const rows = await db.message.findMany({
    where,
    include: {
      author: { select: { id: true, userId: true, name: true, email: true } },
      reactions: { select: { emoji: true, memberId: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Load attachments for these messages (polymorphic: entityType "message").
  const attachmentRows =
    rows.length > 0
      ? await db.attachment.findMany({
          where: {
            workspaceId: workspace.id,
            entityType: "message",
            entityId: { in: rows.map((r) => r.id) },
            status: "uploaded",
          },
          select: {
            id: true,
            name: true,
            contentType: true,
            sizeBytes: true,
            entityId: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const attachmentsByMessage = new Map<string, typeof attachmentRows>();
  for (const a of attachmentRows) {
    const list = attachmentsByMessage.get(a.entityId) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.entityId, list);
  }

  // Mark this thread's notifications as read.
  const linkUrl =
    target.conversationId
      ? `/messages/conv-${target.conversationId}`
      : target.taskId
        ? `/projects/${target.projectId}/tasks/${target.taskId}`
        : `/messages/project-${target.projectId}`;
  await db.notification.updateMany({
    where: { recipientId: member.id, read: false, linkUrl },
    data: { read: true },
  });

  const messages: ChatMessage[] = rows.map((c) => {
    const byEmoji = new Map<string, string[]>();
    for (const r of c.reactions) {
      const list = byEmoji.get(r.emoji) ?? [];
      list.push(r.memberId);
      byEmoji.set(r.emoji, list);
    }
    return {
      id: c.id,
      authorId: c.author.id,
      authorName: c.author.name ?? c.author.email,
      body: c.body.replace(MENTION_RE, "@$1"),
      createdAt: c.createdAt.toISOString(),
      replyToId: c.replyToId ?? null,
      attachments: (attachmentsByMessage.get(c.id) ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        isImage: Boolean(a.contentType && a.contentType.startsWith("image/")),
      })),
      reactions: [...byEmoji.entries()].map(([emoji, memberIds]) => ({
        emoji,
        memberIds,
      })),
    };
  });

  return (
    <ThreadChat
      channel={channel}
      presenceChannel={presenceChannel}
      target={target}
      title={title}
      subtitle={subtitle}
      currentMemberId={member.id}
      messages={messages}
      memberNames={memberNames}
      peerMemberIds={peerMemberIds}
    />
  );
}

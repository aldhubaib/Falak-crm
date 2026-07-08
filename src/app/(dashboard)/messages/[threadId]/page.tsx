import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember, getProjectAccess } from "@/lib/workspace";
import {
  taskChannel,
  projectChannel,
  conversationChannel,
  workspacePresenceChannel,
} from "@/lib/channels";
import { getThreadMessages } from "@/actions/messages";
import { canEdit } from "@/lib/permissions";
import { isArchivedStatus } from "@/lib/utils";
import { ThreadChat, type ThreadTarget } from "./thread-chat";

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
  let archived = false;
  const memberNames: Record<string, string> = {};
  // Who can be @mentioned in this thread's composer.
  let mentionables: { id: string; name: string }[] = [];

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
  } else if (threadId.startsWith("project-")) {
    const projectId = threadId.slice(8);
    const access = await getProjectAccess(projectId);
    if (!access.hasAccess || !access.project) notFound();
    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
      select: { id: true, name: true, status: { select: { name: true } } },
    });
    if (!project) notFound();
    target = { projectId: project.id };
    channel = projectChannel(project.id);
    presenceChannel = projectChannel(project.id);
    title = project.name;
    archived = isArchivedStatus(project.status?.name);
    subtitle = archived ? "Project chat · Archived" : "Project chat";
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
    mentionables = others.map((m) => ({ id: m.id, name: m.name ?? m.email }));
    target = { conversationId: convo.id };
    channel = conversationChannel(convo.id);
    presenceChannel = workspacePresenceChannel(workspace.id);
    title =
      convo.title ??
      (others.map((m) => m.name ?? m.email).join(", ") || "Direct message");
    subtitle = convo.isGroup ? `${convo.participants.length} members` : "Direct message";
  } else {
    notFound();
  }

  // Project/task threads: anyone involved in the project can be @mentioned —
  // the project's team plus workspace owners (owners see every project but
  // aren't project members).
  if (target.projectId) {
    const [projectMembers, owners] = await Promise.all([
      db.projectMember.findMany({
        where: { projectId: target.projectId },
        select: { member: { select: { id: true, name: true, email: true } } },
      }),
      db.workspaceMember.findMany({
        where: { workspaceId: workspace.id, type: "OWNER" },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const map = new Map<string, { id: string; name: string }>();
    for (const m of [...projectMembers.map((pm) => pm.member), ...owners]) {
      map.set(m.id, { id: m.id, name: m.name ?? m.email });
    }
    map.delete(member.id);
    // "@all" notifies the whole thread audience — expanded server-side.
    mentionables = [
      { id: "all", name: "all" },
      ...[...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }

  // Chat-module "view" members can read DMs and project channels but not
  // write to them. Task comment threads follow project permissions instead.
  const chatReadOnly = !target.taskId && !canEdit(member, "chat");

  // Latest page only (50 messages) — older pages load on demand in the client.
  const page = await getThreadMessages(target);

  // Mark this thread's notifications as read. A project thread is the
  // "everything feed" — its inbox counter also rolls up task-level
  // notifications (mentions, rejections) within the project, so opening it
  // must clear those too or the counter never reaches zero.
  if (target.conversationId) {
    await db.notification.updateMany({
      where: {
        recipientId: member.id,
        read: false,
        linkUrl: `/messages/conv-${target.conversationId}`,
      },
      data: { read: true },
    });
  } else if (target.taskId) {
    await db.notification.updateMany({
      where: {
        recipientId: member.id,
        read: false,
        linkUrl: `/projects/${target.projectId}/tasks/${target.taskId}`,
      },
      data: { read: true },
    });
  } else {
    await db.notification.updateMany({
      where: {
        recipientId: member.id,
        read: false,
        OR: [
          { linkUrl: `/messages/project-${target.projectId}` },
          { linkUrl: { startsWith: `/projects/${target.projectId}/` } },
        ],
      },
      data: { read: true },
    });
  }

  return (
    <ThreadChat
      channel={channel}
      presenceChannel={presenceChannel}
      target={target}
      title={title}
      subtitle={subtitle}
      currentMemberId={member.id}
      messages={page.messages}
      hasMoreOlder={page.hasMore}
      memberNames={memberNames}
      peerMemberIds={peerMemberIds}
      mentionables={mentionables}
      archived={archived}
      readOnly={chatReadOnly}
    />
  );
}

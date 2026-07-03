import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { ThreadChat } from "./thread-chat";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  const taskId = threadId.startsWith("task-")
    ? threadId.slice(5)
    : null;

  if (!taskId) notFound();

  const { workspace, member } = await requireWorkspaceWithMember();

  const task = await db.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      project: { workspaceId: workspace.id },
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  if (!task) notFound();

  const comments = await db.taskComment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, userId: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  await db.notification.updateMany({
    where: {
      recipientId: member.id,
      read: false,
      linkUrl: `/projects/${task.projectId}/tasks/${taskId}`,
    },
    data: { read: true },
  });

  return (
    <ThreadChat
      taskId={task.id}
      projectId={task.projectId}
      taskTitle={task.title}
      projectName={task.project.name}
      currentMemberId={member.id}
      comments={comments.map((c) => ({
        id: c.id,
        authorId: c.author.id,
        authorName: c.author.name ?? c.author.email,
        body: c.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1"),
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}

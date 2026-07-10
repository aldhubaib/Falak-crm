import { db } from "@/lib/db";

/** Project members whose role has Auto-Assign on the Todo stage, in join order. */
export async function getTodoAutoAssignMemberIds(
  projectId: string,
  workspaceId: string,
): Promise<string[]> {
  const todoStatus = await db.taskStatus.findFirst({
    where: { workspaceId, name: "Todo" },
    select: { id: true },
  });
  if (!todoStatus) return [];

  const projectMembers = await db.projectMember.findMany({
    where: { projectId },
    include: { role: true },
    orderBy: { addedAt: "asc" },
  });

  return projectMembers
    .filter((pm) => {
      const perms = (pm.role?.permissions as Record<string, unknown>) ?? {};
      const tp =
        (perms.taskPermissions as {
          stages: Record<string, { autoAssign?: boolean }>;
        }) ?? { stages: {} };
      return tp.stages?.[todoStatus.id]?.autoAssign === true;
    })
    .map((pm) => pm.memberId);
}

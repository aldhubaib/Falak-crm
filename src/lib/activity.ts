import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";

type LogParams = {
  entityType: string;
  entityId: string;
  entityName?: string;
  action: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
};

export async function logActivity(params: LogParams) {
  try {
    const workspace = await requireWorkspace();
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId) return;

    await db.activityLog.create({
      data: {
        workspaceId: workspace.id,
        userId,
        userName: user?.fullName || user?.firstName || undefined,
        userImage: user?.imageUrl || undefined,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName,
        action: params.action,
        changes: params.changes ? (params.changes as object) : undefined,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    });
  } catch {
    // Don't let logging failures break the main action
  }
}

export async function getActivityForEntity(entityType: string, entityId: string) {
  const workspace = await requireWorkspace();
  return db.activityLog.findMany({
    where: { workspaceId: workspace.id, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getRecentActivity(limit = 20) {
  const workspace = await requireWorkspace();
  return db.activityLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

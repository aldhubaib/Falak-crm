import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { DEFAULT_PERMISSIONS, ROLE_PRESETS, type MemberWithPermissions, type Permissions } from "@/lib/permissions";

export async function getWorkspace() {
  const { userId } = await auth();
  if (!userId) return null;

  const member = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  return member?.workspace ?? null;
}

export async function getOrCreateWorkspace() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  if (existing) return existing.workspace;

  const user = await currentUser();
  const name = user?.firstName
    ? `${user.firstName}'s Workspace`
    : "My Workspace";
  const slug = `ws-${userId.slice(0, 8)}`;

  const workspace = await db.workspace.create({
    data: {
      name,
      slug,
      baseCurrency: "KWD",
      members: {
        create: {
          userId,
          email: user?.emailAddresses[0]?.emailAddress ?? "",
          name: user?.fullName ?? undefined,
          type: "OWNER",
        },
      },
      currencies: {
        create: [
          { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", isBase: true },
        ],
      },
      pipelines: {
        create: {
          name: "Sales Pipeline",
          isDefault: true,
          stages: {
            create: [
              { name: "Lead", order: 1, color: "#3b82f6", type: "OPEN" },
              { name: "Qualified", order: 2, color: "#8b5cf6", type: "OPEN" },
              { name: "Proposal Sent", order: 3, color: "#a855f7", type: "OPEN" },
              { name: "Negotiation", order: 4, color: "#f59e0b", type: "OPEN" },
              { name: "Won", order: 5, color: "#22c55e", type: "WON" },
              { name: "Lost", order: 6, color: "#ef4444", type: "LOST" },
            ],
          },
        },
      },
      projectStatuses: {
        create: [
          { name: "Active", order: 1, color: "#3b82f6" },
          { name: "On Hold", order: 2, color: "#f59e0b" },
          { name: "Completed", order: 3, color: "#22c55e" },
          { name: "Cancelled", order: 4, color: "#ef4444" },
        ],
      },
      taskStatuses: {
        create: [
          { name: "To Do", order: 1, color: "#6b7280" },
          { name: "In Progress", order: 2, color: "#3b82f6" },
          { name: "Review", order: 3, color: "#f59e0b" },
          { name: "Done", order: 4, color: "#22c55e" },
        ],
      },
      roles: {
        create: Object.values(ROLE_PRESETS).map((preset) => ({
          name: preset.name,
          permissions: JSON.parse(JSON.stringify(preset.permissions)),
        })),
      },
    },
  });

  return workspace;
}

export async function requireWorkspace() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) throw new Error("No workspace found");
  return workspace;
}

export async function requireWorkspaceWithMember(): Promise<{
  workspace: NonNullable<Awaited<ReturnType<typeof getOrCreateWorkspace>>>;
  member: MemberWithPermissions;
}> {
  const workspace = await requireWorkspace();
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const dbMember = await db.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId },
    include: { role: true },
  });

  if (!dbMember) throw new Error("Not a workspace member");

  const rolePermissions = dbMember.role?.permissions as unknown as Permissions | null;

  const permissions: Permissions =
    dbMember.type === "OWNER"
      ? DEFAULT_PERMISSIONS
      : rolePermissions ?? DEFAULT_PERMISSIONS;

  const member: MemberWithPermissions = {
    id: dbMember.id,
    userId: dbMember.userId,
    type: dbMember.type,
    workspaceId: dbMember.workspaceId,
    permissions,
  };

  return { workspace, member };
}

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEFAULT_PERMISSIONS, ROLE_PRESETS, type MemberWithPermissions, type Permissions } from "@/lib/permissions";

export const getWorkspace = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const member = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  return member?.workspace ?? null;
});

export const getOrCreateWorkspace = cache(async () => {
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
          { name: "Todo", order: 1, color: "#6b7280" },
          { name: "In Progress", order: 2, color: "#3b82f6" },
          { name: "Review", order: 3, color: "#f59e0b" },
          { name: "Completed", order: 4, color: "#22c55e" },
          { name: "Published", order: 5, color: "#8b5cf6" },
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
});

export const requireWorkspace = cache(async () => {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) throw new Error("No workspace found");
  return workspace;
});

export const requireWorkspaceWithMember = cache(async () => {
  const workspace = await requireWorkspace();
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const dbMember = await db.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId },
    include: { role: true },
  });

  if (!dbMember) throw new Error("Not a workspace member");

  const rolePermissions = dbMember.role?.permissions as unknown as Permissions | null;

  let permissions: Permissions =
    dbMember.type === "OWNER"
      ? DEFAULT_PERMISSIONS
      : rolePermissions ?? DEFAULT_PERMISSIONS;

  const cookieStore = await cookies();
  const testRoleCookie = cookieStore.get("test_role_id")?.value;
  if (testRoleCookie && dbMember.type === "OWNER") {
    const testRole = await db.role.findFirst({
      where: { id: testRoleCookie, workspaceId: workspace.id },
    });
    if (testRole) {
      permissions = (testRole.permissions as unknown as Permissions) ?? DEFAULT_PERMISSIONS;
    }
  }

  const member: MemberWithPermissions = {
    id: dbMember.id,
    userId: dbMember.userId,
    type: dbMember.type,
    workspaceId: dbMember.workspaceId,
    permissions,
  };

  return { workspace, member };
});

// Resolves a member's effective permissions *within a specific project*.
// Global modules (deals, invoices, settings, etc.) keep their workspace-level
// values; the `projects` module and task-stage permissions are governed by the
// member's per-project role. Non-assigned members (that aren't owners or the
// project's record owner) have no access to the project.
export const getProjectAccess = cache(async (projectId: string) => {
  const { workspace, member } = await requireWorkspaceWithMember();

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, ownerId: true },
  });

  if (!project) {
    return { workspace, member, project: null, hasAccess: false, permissions: member.permissions };
  }

  // Owners and the project's record owner always have full access.
  if (member.type === "OWNER" || (project.ownerId && project.ownerId === member.userId)) {
    return { workspace, member, project, hasAccess: true, permissions: member.permissions };
  }

  const projectMember = await db.projectMember.findFirst({
    where: { projectId, memberId: member.id },
    include: { role: true },
  });

  if (!projectMember) {
    return {
      workspace,
      member,
      project,
      hasAccess: false,
      permissions: { ...member.permissions, projects: "none" as const, taskPermissions: { stages: {} } },
    };
  }

  const rolePerms = (projectMember.role?.permissions as unknown as Permissions | null) ?? null;
  const permissions: Permissions = {
    ...member.permissions,
    projects: rolePerms?.projects ?? "view",
    taskPermissions: rolePerms?.taskPermissions ?? { stages: {} },
  };

  return { workspace, member, project, hasAccess: true, permissions };
});

// Throws unless the current member has full edit rights on the project
// (project-level admin actions: settings, templates, team, project meta).
export const requireProjectEdit = async (projectId: string) => {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  if (access.permissions.projects !== "full") throw new Error("Permission denied");
  return access;
};

function hasAnyTaskStagePermission(permissions: Permissions): boolean {
  const stages = permissions.taskPermissions?.stages;
  if (!stages) return false;
  return Object.values(stages).some(
    (s) => s.create || s.modify || s.forward || s.rollback || s.delete
  );
}

// Throws unless the current member can work on tasks/deliverables in the
// project: either full project access, or a project role that grants at least
// one task-stage permission. Non-members are always rejected.
export const requireProjectWork = async (projectId: string) => {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  if (access.permissions.projects === "full") return access;
  if (hasAnyTaskStagePermission(access.permissions)) return access;
  throw new Error("Permission denied");
};

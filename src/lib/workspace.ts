import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";
import {
  DEFAULT_PERMISSIONS,
  ROLE_PRESETS,
  mergePermissions,
  normalizePermissions,
  canView,
  type MemberWithPermissions,
  type ModuleKey,
  type Permissions,
} from "@/lib/permissions";

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

  let user: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    user = await currentUser();
  } catch {
    // Clerk API unreachable or session invalid — fall back to DB lookup
  }
  const email =
    user?.emailAddresses?.[0]?.emailAddress ??
    user?.primaryEmailAddress?.emailAddress ??
    null;

  // Claim a pending invitation for this account. Invited members are created
  // with a placeholder `pending_*` userId until the person first signs in; we
  // link that record to their real Clerk id (matched by email) so they join
  // the workspace they were invited to instead of getting a fresh empty one.
  if (email) {
    const invited = await db.workspaceMember.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        userId: { startsWith: "pending_" },
      },
      include: { workspace: true },
      orderBy: { joinedAt: "asc" },
    });
    if (invited) {
      const alreadyMember = await db.workspaceMember.findFirst({
        where: { workspaceId: invited.workspaceId, userId },
        select: { id: true },
      });
      if (alreadyMember) {
        // Real membership already exists; drop the duplicate placeholder.
        await db.workspaceMember.delete({ where: { id: invited.id } }).catch(() => {});
      } else {
        await db.workspaceMember.update({ where: { id: invited.id }, data: { userId } });
      }
      // If this account previously auto-created its own empty personal
      // workspace (before being linked), drop that membership so the account
      // resolves deterministically to the workspace they were invited to.
      await db.workspaceMember.deleteMany({
        where: {
          userId,
          type: "OWNER",
          workspaceId: { not: invited.workspaceId },
          workspace: { slug: { startsWith: `ws-${userId.slice(0, 8)}` } },
        },
      });
      return invited.workspace;
    }
  }

  const existing = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  if (existing) return existing.workspace;

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
          imageUrl: user?.imageUrl ?? undefined,
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

// Best-effort: keep the current member's cached profile (name + Google photo)
// in sync with Clerk. Only writes when something actually changed so it's cheap
// to call on every dashboard load. Swallows all errors — it's non-critical.
export const syncCurrentMemberProfile = async () => {
  try {
    const { userId } = await auth();
    if (!userId) return;
    const user = await currentUser();
    if (!user) return;

    const imageUrl = user.imageUrl ?? null;
    const name = user.fullName ?? null;
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null;

    const rows = await db.workspaceMember.findMany({
      where: { userId },
      select: { id: true, imageUrl: true, name: true },
    });
    await Promise.all(
      rows
        .filter((r) => r.imageUrl !== imageUrl || (name && r.name !== name))
        .map((r) =>
          db.workspaceMember.update({
            where: { id: r.id },
            data: {
              imageUrl,
              ...(name ? { name } : {}),
              ...(email ? { email } : {}),
            },
          }),
        ),
    );
  } catch {
    // ignore — profile sync is opportunistic
  }
};

export const requireWorkspaceWithMember = cache(async () => {
  const workspace = await requireWorkspace();
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const dbMember = await db.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId },
    include: { role: true },
  });

  if (!dbMember) throw new Error("Not a workspace member");

  let permissions: Permissions;
  if (dbMember.type === "OWNER") {
    permissions = DEFAULT_PERMISSIONS;
  } else {
    // A member's global module access is derived from the role(s) they hold
    // across the projects they're assigned to (merged, most permissive). A
    // legacy workspace-level role, if any, is merged in for backwards compat.
    // The derivation costs two extra queries on every single server action, so
    // it's cached in Redis with a short TTL (invalidated on role changes).
    permissions = await cached(`perms:${dbMember.id}`, 30, async () => {
      const [projectRoles, assignedCount] = await Promise.all([
        db.projectMember.findMany({
          where: { memberId: dbMember.id, roleId: { not: null } },
          select: { role: { select: { permissions: true } } },
        }),
        db.projectMember.count({ where: { memberId: dbMember.id } }),
      ]);
      const roleList: unknown[] = projectRoles
        .map((pr) => pr.role?.permissions)
        .filter((p) => !!p);
      if (dbMember.role?.permissions) {
        roleList.push(dbMember.role.permissions);
      }
      let merged = mergePermissions(roleList);

      // Being assigned to a project grants at least read access to the
      // Projects module so the member can find and open their project(s).
      if (assignedCount > 0 && merged.projects === "none") {
        merged = { ...merged, projects: "view" };
      }
      return merged;
    });
  }

  const cookieStore = await cookies();
  const testRoleCookie = cookieStore.get("test_role_id")?.value;
  if (testRoleCookie && dbMember.type === "OWNER") {
    const testRole = await db.role.findFirst({
      where: { id: testRoleCookie, workspaceId: workspace.id },
    });
    if (testRole) {
      permissions = normalizePermissions(testRole.permissions);
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

  const rolePerms = projectMember.role?.permissions
    ? normalizePermissions(projectMember.role.permissions)
    : null;
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

// Returns the set of projects the current member may access. Owners (and the
// workspace default) see everything (`all: true`); other members see only
// projects they own the record for or are assigned to.
export const getAccessibleProjectScope = async () => {
  const { workspace, member } = await requireWorkspaceWithMember();

  if (member.type === "OWNER") {
    return { workspace, member, all: true as const, projectIds: null };
  }

  const rows = await db.project.findMany({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
      OR: [{ ownerId: member.userId }, { members: { some: { memberId: member.id } } }],
    },
    select: { id: true },
  });

  return { workspace, member, all: false as const, projectIds: rows.map((r) => r.id) };
};

function hasAnyTaskStagePermission(permissions: Permissions): boolean {
  const stages = permissions.taskPermissions?.stages;
  if (!stages) return false;
  return Object.values(stages).some(
    (s) => s.create || s.modify || s.forward || s.rollback || s.delete
  );
}

// Server-side route guard for a permissioned module. Call from the module's
// layout (or page) — members without at least view access never see the
// module's routes, matching the sidebar which hides the entry entirely.
export const requireModuleView = async (module: ModuleKey) => {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, module)) redirect("/dashboard");
  return { workspace, member };
};

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

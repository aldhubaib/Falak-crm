import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cached, claimThrottle } from "@/lib/cache";
import {
  DEFAULT_PERMISSIONS,
  MODULES,
  mergePermissions,
  normalizePermissions,
  canView,
  hasCap,
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
        // Fill in the Google profile (photo + name) at claim time so the very
        // first page load already shows it — syncCurrentMemberProfile runs
        // concurrently with this and misses rows that are still pending_*.
        await db.workspaceMember.update({
          where: { id: invited.id },
          data: {
            userId,
            imageUrl: user?.imageUrl ?? null,
            ...(user?.fullName ? { name: user.fullName } : {}),
          },
        });
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

  // Invite-only: a signed-in account with no membership and no pending
  // invitation (matched by email above) gets nothing — no auto-created
  // personal workspace. The dashboard redirects them to /not-invited.
  return null;
});

export const requireWorkspace = cache(async () => {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/not-invited");
  return workspace;
});

// How often the Clerk profile → DB sync may run per user. The layout calls
// syncCurrentMemberProfile on every dashboard render (including every
// router.refresh), and currentUser() is a Clerk Backend API round-trip —
// without a throttle it was the single biggest per-request latency tax.
const PROFILE_SYNC_TTL_SECONDS = 15 * 60;

// Best-effort: keep the current member's cached profile (name + Google photo)
// in sync with Clerk. Throttled to once per PROFILE_SYNC_TTL_SECONDS per user
// via Redis so the Clerk API stays off the hot path. Swallows all errors —
// it's non-critical.
export const syncCurrentMemberProfile = async () => {
  try {
    const { userId } = await auth();
    if (!userId) return;
    // At most one Clerk round-trip per user per window. Without Redis the
    // throttle is a no-op (dev), matching the old behavior.
    if (!(await claimThrottle(`profile-sync:${userId}`, PROFILE_SYNC_TTL_SECONDS))) {
      return;
    }
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

// A member's global module access is derived from the role(s) they hold
// across the projects they're assigned to (merged, most permissive). A
// legacy workspace-level role, if any, is merged in for backwards compat.
// The derivation costs two extra queries on every single server action, so
// it's cached in Redis with a short TTL (invalidated on role changes).
const deriveMemberPermissions = async (member: {
  id: string;
  role: { permissions: unknown } | null;
}): Promise<Permissions> =>
  cached(`perms:${member.id}`, 30, async () => {
    const [projectRoles, assignedCount] = await Promise.all([
      db.projectMember.findMany({
        where: { memberId: member.id, roleId: { not: null } },
        select: { role: { select: { permissions: true } } },
      }),
      db.projectMember.count({ where: { memberId: member.id } }),
    ]);
    const roleList: unknown[] = projectRoles
      .map((pr) => pr.role?.permissions)
      .filter((p) => !!p);
    if (member.role?.permissions) {
      roleList.push(member.role.permissions);
    }
    let merged = mergePermissions(roleList);

    // Being assigned to a project grants at least read access to the
    // Projects module so the member can find and open their project(s).
    if (assignedCount > 0 && merged.projects === "none") {
      merged = { ...merged, projects: "view" };
    }
    return merged;
  });

export const IMPERSONATE_COOKIE = "impersonate_member_id";
export const TEST_ROLE_COOKIE = "test_role_id";

export const requireWorkspaceWithMember = cache(async () => {
  const workspace = await requireWorkspace();
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const dbMember = await db.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId },
    include: { role: true },
  });

  if (!dbMember) throw new Error("Not a workspace member");

  const cookieStore = await cookies();

  // Owner impersonation ("Log in as" from Settings → Team): the whole app
  // resolves as the target member — their id, type, permissions and project
  // assignments — so what the owner sees is exactly what that member sees.
  const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
  if (impersonateId && dbMember.type === "OWNER" && impersonateId !== dbMember.id) {
    const target = await db.workspaceMember.findFirst({
      where: { id: impersonateId, workspaceId: workspace.id, type: { not: "OWNER" } },
      include: { role: true },
    });
    if (target) {
      const member: MemberWithPermissions = {
        id: target.id,
        userId: target.userId,
        type: target.type,
        workspaceId: target.workspaceId,
        permissions: await deriveMemberPermissions(target),
      };
      return { workspace, member };
    }
  }

  let permissions: Permissions;
  if (dbMember.type === "OWNER") {
    permissions = DEFAULT_PERMISSIONS;
  } else {
    permissions = await deriveMemberPermissions(dbMember);
  }

  const testRoleCookie = cookieStore.get(TEST_ROLE_COOKIE)?.value;
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

// The signed-in user's REAL membership, ignoring impersonation and test-role
// cookies. Used by the view-as actions/banner, which must always act on the
// actual owner even while the rest of the app resolves as someone else.
export const getRealMember = cache(async () => {
  const workspace = await requireWorkspace();
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const dbMember = await db.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId },
  });
  if (!dbMember) throw new Error("Not a workspace member");
  return { workspace, member: dbMember };
});

export type ViewAsState =
  | { kind: "member"; name: string }
  | { kind: "role"; name: string }
  | null;

// What the "Viewing as …" banner should show, if anything. Server-driven so
// the banner appears/disappears on the very next render (router.refresh)
// after starting or exiting — no client re-fetch involved.
export const getViewAsState = cache(async (): Promise<ViewAsState> => {
  const { workspace, member } = await getRealMember();
  if (member.type !== "OWNER") return null;

  const cookieStore = await cookies();

  const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
  if (impersonateId && impersonateId !== member.id) {
    const target = await db.workspaceMember.findFirst({
      where: { id: impersonateId, workspaceId: workspace.id, type: { not: "OWNER" } },
      select: { name: true, email: true },
    });
    if (target) {
      return { kind: "member", name: target.name || target.email || "member" };
    }
  }

  const testRoleId = cookieStore.get(TEST_ROLE_COOKIE)?.value;
  if (testRoleId) {
    const role = await db.role.findFirst({
      where: { id: testRoleId, workspaceId: workspace.id },
      select: { name: true },
    });
    if (role) return { kind: "role", name: role.name };
  }

  return null;
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

// Throws unless the current member can manage the project's team. The
// "assign people to projects" capability (Settings → Roles → Projects) is
// authoritative; full-level roles have it on by default via normalization.
export const requireProjectAssign = async (projectId: string) => {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  if (!hasCap(access.permissions, "projects", "assignMembers")) {
    throw new Error("Permission denied");
  }
  return access;
};

// Throws unless the current member can modify project settings (name, photo,
// status, description, templates). Gated by the "modify project settings"
// capability; full-level roles have it on by default via normalization.
export const requireProjectSettings = async (projectId: string) => {
  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) throw new Error("Permission denied");
  if (!hasCap(access.permissions, "projects", "editSettings")) {
    throw new Error("Permission denied");
  }
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

// First destination the member is allowed to see — the registry's first
// module with a sidebar entry that the member can view (Dashboard when
// permitted, since it's first). Account settings is the always-accessible
// last resort.
export const defaultLandingPath = (member: MemberWithPermissions): string => {
  for (const mod of MODULES) {
    if (mod.href && canView(member, mod.key)) return mod.href;
  }
  return "/account";
};

// Server-side route guard for a permissioned module. Call from the module's
// layout (or page) — members without at least view access never see the
// module's routes, matching the sidebar which hides the entry entirely.
export const requireModuleView = async (module: ModuleKey) => {
  const { workspace, member } = await requireWorkspaceWithMember();
  // Redirect to a module the member CAN view — never back to the one that
  // just failed, so this can't loop (dashboard itself is permissioned).
  if (!canView(member, module)) redirect(defaultLandingPath(member));
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

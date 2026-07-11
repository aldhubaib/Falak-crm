"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit, newRolePermissions, normalizePermissions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { safeAction, type ActionResult } from "@/lib/action";
import { invalidateCache } from "@/lib/cache";

// Permission changes must take effect immediately — drop the cached derived
// permissions of every member who holds this role (workspace-level or via a
// project assignment).
async function invalidateRoleMembersPerms(workspaceId: string, roleId: string) {
  const [direct, viaProjects] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId, roleId },
      select: { id: true },
    }),
    db.projectMember.findMany({
      where: { roleId, member: { workspaceId } },
      select: { memberId: true },
    }),
  ]);
  const ids = new Set<string>([
    ...direct.map((m) => m.id),
    ...viaProjects.map((m) => m.memberId),
  ]);
  await Promise.all([...ids].map((id) => invalidateCache(`perms:${id}`)));
}

export async function getTeamMembers() {
  const { workspace } = await requireWorkspaceWithMember();
  const [members, roles, titles] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { role: true, capacityTitle: true },
      orderBy: { joinedAt: "asc" },
    }),
    db.role.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
    db.title.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);
  return { members, roles, titles };
}

export async function assignRole(memberId: string, roleId: string | null): Promise<ActionResult> {
  return safeAction("Assign Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    await db.workspaceMember.update({
      where: { id: memberId, workspaceId: workspace.id },
      data: { roleId: roleId || null },
    });

    await invalidateCache(`perms:${memberId}`);
    revalidatePath("/settings/team");
  }, { memberId, roleId });
}

export async function renameMember(memberId: string, name: string): Promise<ActionResult> {
  return safeAction("Rename Member", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");

    const target = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: workspace.id },
      select: { id: true, userId: true },
    });
    if (!target) throw new Error("Member not found");

    await db.workspaceMember.update({
      where: { id: target.id },
      data: { name: trimmed },
    });

    // Mirror into Clerk (best-effort) so the auth profile matches everywhere.
    // Invited-but-not-signed-up members have a placeholder userId — skip those.
    if (!target.userId.startsWith("pending_")) {
      try {
        const client = await clerkClient();
        const [firstName, ...rest] = trimmed.split(/\s+/);
        await client.users.updateUser(target.userId, {
          firstName,
          lastName: rest.join(" "),
        });
      } catch {}
    }

    revalidatePath("/settings/team");
  }, { memberId });
}

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  return safeAction("Invite Member", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    const email = formData.get("email") as string;
    const name = (formData.get("name") as string) || undefined;
    const type = (formData.get("type") as string) || "MEMBER";

    // Invite-only is enforced by the app itself: Clerk sign-ups are open, but
    // accounts whose email doesn't match a member row land on /not-invited.
    // Adding this row is what grants access — no email is sent.
    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: `pending_${Date.now()}`,
        email,
        name,
        type: type as "MEMBER" | "FREELANCER",
      },
    });

    revalidatePath("/settings/team");
  }, { formFields: Object.fromEntries(formData) });
}

export async function createRole(name: string): Promise<ActionResult<string>> {
  return safeAction("Create Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Role name cannot be empty");

    const existing = await db.role.findFirst({
      where: { workspaceId: workspace.id, name: trimmed },
    });
    if (existing) throw new Error(`A role named "${trimmed}" already exists`);

    const role = await db.role.create({
      data: {
        workspaceId: workspace.id,
        name: trimmed,
        permissions: JSON.parse(JSON.stringify(newRolePermissions())),
      },
    });

    revalidatePath("/settings/team");
    return role.id;
  });
}

export async function updateRole(roleId: string, data: { name?: string; permissions?: unknown }): Promise<ActionResult> {
  return safeAction("Update Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new Error("Role name cannot be empty");
      const existing = await db.role.findFirst({
        where: { workspaceId: workspace.id, name: trimmed, id: { not: roleId } },
      });
      if (existing) throw new Error(`A role named "${trimmed}" already exists`);
      data.name = trimmed;
    }

    await db.role.update({
      where: { id: roleId, workspaceId: workspace.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        // Never trust the client payload for something this sensitive:
        // normalize to known modules/levels before storing.
        ...(data.permissions !== undefined && {
          permissions: JSON.parse(JSON.stringify(normalizePermissions(data.permissions))),
        }),
      },
    });

    if (data.permissions !== undefined) {
      await invalidateRoleMembersPerms(workspace.id, roleId);
    }
    revalidatePath("/settings/team");
  });
}

export async function deleteRole(
  roleId: string,
  reassignToRoleId?: string,
): Promise<ActionResult> {
  return safeAction("Delete Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    // Capture affected members before the role links are severed.
    await invalidateRoleMembersPerms(workspace.id, roleId);

    if (reassignToRoleId) {
      const target = await db.role.findFirst({
        where: { id: reassignToRoleId, workspaceId: workspace.id },
        select: { id: true },
      });
      if (!target || reassignToRoleId === roleId) {
        throw new Error("Invalid role to move members to");
      }
      await db.workspaceMember.updateMany({
        where: { workspaceId: workspace.id, roleId },
        data: { roleId: reassignToRoleId },
      });
      // Members moved to a different role need their derived perms recomputed.
      await invalidateRoleMembersPerms(workspace.id, reassignToRoleId);
    } else {
      await db.workspaceMember.updateMany({
        where: { workspaceId: workspace.id, roleId },
        data: { roleId: null },
      });
    }

    await db.role.delete({ where: { id: roleId, workspaceId: workspace.id } });
    revalidatePath("/settings/team");
  });
}

export async function startTestRole(roleId: string): Promise<ActionResult> {
  return safeAction("Test Role", async () => {
    const { workspace } = await requireWorkspaceWithMember();

    const role = await db.role.findFirst({
      where: { id: roleId, workspaceId: workspace.id },
    });
    if (!role) throw new Error("Role not found");

    const cookieStore = await cookies();
    cookieStore.set("test_role_id", roleId, {
      path: "/",
      maxAge: 3600,
      httpOnly: true,
      sameSite: "lax",
    });

    revalidatePath("/");
  });
}

export async function stopTestRole(): Promise<ActionResult> {
  return safeAction("Stop Test Role", async () => {
    const cookieStore = await cookies();
    cookieStore.delete("test_role_id");
    revalidatePath("/");
  });
}

export async function getTestingRole(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("test_role_id")?.value ?? null;
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return safeAction("Remove Member", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    const target = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: workspace.id },
    });
    if (!target) throw new Error("Member not found");
    if (target.type === "OWNER") throw new Error("Cannot remove workspace owner");

    await db.workspaceMember.delete({
      where: { id: memberId },
    });

    revalidatePath("/settings/team");
  }, { memberId });
}

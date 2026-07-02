"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { safeAction, type ActionResult } from "@/lib/action";

export async function getTeamMembers() {
  const { workspace } = await requireWorkspaceWithMember();
  const [members, roles] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { role: true },
      orderBy: { joinedAt: "asc" },
    }),
    db.role.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);
  return { members, roles };
}

export async function assignRole(memberId: string, roleId: string | null): Promise<ActionResult> {
  return safeAction("Assign Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    await db.workspaceMember.update({
      where: { id: memberId, workspaceId: workspace.id },
      data: { roleId: roleId || null },
    });

    revalidatePath("/settings/team");
  }, { memberId, roleId });
}

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  return safeAction("Invite Member", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    const email = formData.get("email") as string;
    const name = (formData.get("name") as string) || undefined;
    const roleId = (formData.get("roleId") as string) || undefined;
    const type = (formData.get("type") as string) || "MEMBER";

    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: `pending_${Date.now()}`,
        email,
        name,
        type: type as "MEMBER" | "FREELANCER",
        roleId: roleId || null,
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
        permissions: {
          deals: "view",
          pipeline: "none",
          projects: "view",
          invoices: "none",
          settings: "none",
          team: "none",
        },
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
        ...(data.permissions !== undefined && { permissions: data.permissions as object }),
      },
    });

    revalidatePath("/settings/team");
  });
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  return safeAction("Delete Role", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (!canEdit(member, "team")) throw new Error("Permission denied");

    await db.workspaceMember.updateMany({
      where: { workspaceId: workspace.id, roleId },
      data: { roleId: null },
    });

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

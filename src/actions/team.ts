"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
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

    revalidatePath("/dashboard/settings/team");
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

    revalidatePath("/dashboard/settings/team");
  }, { formFields: Object.fromEntries(formData) });
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

    revalidatePath("/dashboard/settings/team");
  }, { memberId });
}

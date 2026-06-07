"use server";

import { requireWorkspaceWithMember } from "@/lib/workspace";
import { type Permissions } from "@/lib/permissions";

export async function getCurrentPermissions(): Promise<Permissions> {
  const { member } = await requireWorkspaceWithMember();
  return member.permissions;
}

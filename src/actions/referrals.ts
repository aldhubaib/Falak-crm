"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getReferrals() {
  const workspace = await requireWorkspace();
  return db.referral.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });
}

export async function createReferral(name: string) {
  const workspace = await requireWorkspace();

  const last = await db.referral.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "desc" },
  });

  const referral = await db.referral.create({
    data: {
      workspaceId: workspace.id,
      name,
      order: (last?.order ?? 0) + 1,
    },
  });

  revalidatePath("/dashboard/companies");
  return referral;
}

export async function deleteReferral(id: string) {
  const workspace = await requireWorkspace();
  await db.referral.delete({
    where: { id, workspaceId: workspace.id },
  });
  revalidatePath("/dashboard/companies");
}

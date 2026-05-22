"use server";

import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

export async function getIndustries() {
  const workspace = await requireWorkspace();
  return db.industry.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  });
}

export async function createIndustry(name: string) {
  const workspace = await requireWorkspace();

  const last = await db.industry.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "desc" },
  });

  const industry = await db.industry.create({
    data: {
      workspaceId: workspace.id,
      name,
      order: (last?.order ?? 0) + 1,
    },
  });

  revalidatePath("/dashboard/companies");
  return industry;
}

export async function deleteIndustry(id: string) {
  const workspace = await requireWorkspace();
  await db.industry.delete({
    where: { id, workspaceId: workspace.id },
  });
  revalidatePath("/dashboard/companies");
}

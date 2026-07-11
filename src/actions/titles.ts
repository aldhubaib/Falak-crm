"use server";

import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import { isReviewStageName } from "@/lib/checklist-config";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/lib/action";
import { recalculateTitleEffortLocks } from "@/lib/effort-lock";

// Capacity Titles: each title (Junior A, Senior, Creator…) carries effort
// rates — minutes per unit of content per checklist field, and flat minutes
// per pass through review stages. Separate from permission Roles.

async function requireTeamEdit() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "team")) throw new Error("Permission denied");
  return { workspace, member };
}

export async function getTitlesData() {
  const { workspace, member } = await requireWorkspaceWithMember();
  const [titles, templates, statuses, members] = await Promise.all([
    db.title.findMany({
      where: { workspaceId: workspace.id },
      include: { fieldRates: true, stageRates: true },
      orderBy: { createdAt: "asc" },
    }),
    db.checklistTemplate.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        items: {
          where: { hidden: false, effortUnit: { not: null } },
          orderBy: { order: "asc" },
          select: { id: true, name: true, effortUnit: true, phase: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: { titleId: true },
    }),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const m of members) {
    if (m.titleId) memberCounts[m.titleId] = (memberCounts[m.titleId] ?? 0) + 1;
  }

  return {
    titles,
    templates,
    // Review work is charged per pass through these stages.
    reviewStages: statuses.filter((s) => isReviewStageName(s.name)),
    memberCounts,
    isOwner: member.type === "OWNER",
  };
}

export async function createTitle(name: string): Promise<ActionResult<string>> {
  return safeAction("Create Title", async () => {
    const { workspace } = await requireTeamEdit();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Title name cannot be empty");

    const existing = await db.title.findFirst({
      where: { workspaceId: workspace.id, name: trimmed },
    });
    if (existing) throw new Error(`A title named "${trimmed}" already exists`);

    const title = await db.title.create({
      data: { workspaceId: workspace.id, name: trimmed },
    });
    revalidatePath("/settings/titles");
    return title.id;
  });
}

export async function renameTitle(titleId: string, name: string): Promise<ActionResult> {
  return safeAction("Rename Title", async () => {
    const { workspace } = await requireTeamEdit();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Title name cannot be empty");

    const existing = await db.title.findFirst({
      where: { workspaceId: workspace.id, name: trimmed, id: { not: titleId } },
    });
    if (existing) throw new Error(`A title named "${trimmed}" already exists`);

    await db.title.update({
      where: { id: titleId, workspaceId: workspace.id },
      data: { name: trimmed },
    });
    revalidatePath("/settings/titles");
  }, { titleId });
}

// Duplicate a title with all its rates — the fast way to create "Senior =
// Junior A but faster" without re-typing every number.
export async function duplicateTitle(titleId: string): Promise<ActionResult<string>> {
  return safeAction("Duplicate Title", async () => {
    const { workspace } = await requireTeamEdit();
    const source = await db.title.findFirst({
      where: { id: titleId, workspaceId: workspace.id },
      include: { fieldRates: true, stageRates: true },
    });
    if (!source) throw new Error("Title not found");

    // Find a free "Name (copy)" / "Name (copy 2)" name.
    const siblings = await db.title.findMany({
      where: { workspaceId: workspace.id },
      select: { name: true },
    });
    const names = new Set(siblings.map((s) => s.name));
    let name = `${source.name} (copy)`;
    for (let n = 2; names.has(name); n++) name = `${source.name} (copy ${n})`;

    const copy = await db.title.create({
      data: {
        workspaceId: workspace.id,
        name,
        fieldRates: {
          create: source.fieldRates.map((r) => ({
            templateItemId: r.templateItemId,
            minutesPerUnit: r.minutesPerUnit,
          })),
        },
        stageRates: {
          create: source.stageRates.map((r) => ({
            statusId: r.statusId,
            minutesPerPass: r.minutesPerPass,
          })),
        },
      },
    });
    revalidatePath("/settings/titles");
    return copy.id;
  }, { titleId });
}

export async function deleteTitle(titleId: string): Promise<ActionResult> {
  return safeAction("Delete Title", async () => {
    const { workspace } = await requireTeamEdit();
    // Members holding this title fall back to "no title" (FK is SetNull).
    await db.title.delete({ where: { id: titleId, workspaceId: workspace.id } });
    revalidatePath("/settings/titles");
    revalidatePath("/settings/team");
  }, { titleId });
}

// Upsert (or clear, when minutes is null) the rate for one checklist field.
export async function setTitleFieldRate(
  titleId: string,
  templateItemId: string,
  minutesPerUnit: number | null,
): Promise<ActionResult> {
  return safeAction("Set Field Rate", async () => {
    const { workspace } = await requireTeamEdit();
    const title = await db.title.findFirst({
      where: { id: titleId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!title) throw new Error("Title not found");

    if (minutesPerUnit == null) {
      await db.titleFieldRate.deleteMany({ where: { titleId, templateItemId } });
    } else {
      if (!(minutesPerUnit >= 0)) throw new Error("Rate must be zero or more");
      await db.titleFieldRate.upsert({
        where: { titleId_templateItemId: { titleId, templateItemId } },
        create: { titleId, templateItemId, minutesPerUnit },
        update: { minutesPerUnit },
      });
    }
    revalidatePath("/settings/titles");
  }, { titleId, templateItemId });
}

// Upsert (or clear) the flat minutes charged per pass through a review stage.
export async function setTitleStageRate(
  titleId: string,
  statusId: string,
  minutesPerPass: number | null,
): Promise<ActionResult> {
  return safeAction("Set Stage Rate", async () => {
    const { workspace } = await requireTeamEdit();
    const title = await db.title.findFirst({
      where: { id: titleId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!title) throw new Error("Title not found");

    if (minutesPerPass == null) {
      await db.titleStageRate.deleteMany({ where: { titleId, statusId } });
    } else {
      if (!(minutesPerPass >= 0)) throw new Error("Rate must be zero or more");
      await db.titleStageRate.upsert({
        where: { titleId_statusId: { titleId, statusId } },
        create: { titleId, statusId, minutesPerPass },
        update: { minutesPerPass },
      });
    }
    revalidatePath("/settings/titles");
  }, { titleId, statusId });
}

// Assign a capacity title to a member (or clear it).
export async function assignMemberTitle(
  memberId: string,
  titleId: string | null,
): Promise<ActionResult> {
  return safeAction("Assign Title", async () => {
    const { workspace } = await requireTeamEdit();
    await db.workspaceMember.update({
      where: { id: memberId, workspaceId: workspace.id },
      data: { titleId: titleId || null },
    });
    revalidatePath("/settings/team");
  }, { memberId, titleId });
}

// Set a member's weekly working-hours capacity.
export async function setMemberWeeklyHours(
  memberId: string,
  weeklyHours: number,
): Promise<ActionResult> {
  return safeAction("Set Weekly Hours", async () => {
    const { workspace } = await requireTeamEdit();
    if (!(weeklyHours >= 0 && weeklyHours <= 168)) {
      throw new Error("Weekly hours must be between 0 and 168");
    }
    await db.workspaceMember.update({
      where: { id: memberId, workspaceId: workspace.id },
      data: { weeklyHours },
    });
    revalidatePath("/settings/team");
  }, { memberId });
}

// Re-apply this title's current rates to locked effort on completed tasks
// done by members who hold it. Owner-only — bulk historical correction.
export async function recalculateTitleEffort(
  titleId: string,
): Promise<ActionResult<{ fieldCount: number; taskCount: number }>> {
  return safeAction("Recalculate Title Effort", async () => {
    const { workspace, member } = await requireWorkspaceWithMember();
    if (member.type !== "OWNER") throw new Error("Permission denied");

    const title = await db.title.findFirst({
      where: { id: titleId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!title) throw new Error("Title not found");

    return recalculateTitleEffortLocks(titleId, workspace.id);
  }, { titleId });
}

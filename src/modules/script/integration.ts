import "server-only";
import { db } from "@/lib/db";
import { requireModuleView, requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit, canView } from "@/lib/permissions";

// The ONLY file in this module allowed to read CRM data or touch CRM tables.
// Everything else under src/modules/script goes through the functions here, so
// the surface between the two is one file wide and a CRM refactor can only
// break this file.

export async function requireScriptViewer() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canView(member, "scripts")) throw new Error("Permission denied");
  return { workspace, member };
}

/** Page-level guard: redirects instead of throwing, for route segments. */
export async function requireScriptPage() {
  return requireModuleView("scripts");
}

export async function requireScriptEditor() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "scripts")) throw new Error("Permission denied");
  return { workspace, member };
}

export type ProjectOption = { id: string; name: string };

/** Projects a script can be attached to. */
export async function listProjects(workspaceId: string): Promise<ProjectOption[]> {
  const rows = await db.project.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

/**
 * Resolves the project a script points at. Scripts hold projectId as a plain
 * string with no foreign key, so this is where the reference is validated —
 * returns null if the project was deleted or belongs to another workspace.
 */
export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<ProjectOption | null> {
  return db.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
}

/** Names for a set of project ids, for list screens. */
export async function getProjectNames(
  workspaceId: string,
  projectIds: string[],
): Promise<Map<string, string>> {
  if (!projectIds.length) return new Map();
  const rows = await db.project.findMany({
    where: { id: { in: projectIds }, workspaceId },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

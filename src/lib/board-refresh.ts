import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { publishTaskEvent } from "@/lib/realtime";

// Settings saves that change stage rules (role permission flags, task-type
// field rules) must reach every open kanban immediately: broadcast
// `board.refresh` on each project channel (open boards refetch their data and
// re-run the SSR render so frozen movePerms update), and revalidate the
// project routes so the next server render isn't served from a stale cache.
// Best-effort — a broadcast failure must never break the settings save.
export async function refreshWorkspaceBoards(workspaceId: string): Promise<void> {
  try {
    const projects = await db.project.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    });
    for (const p of projects) {
      publishTaskEvent(p.id, { type: "board.refresh" });
      // "layout" covers the board page and every nested task detail route.
      revalidatePath(`/projects/${p.id}`, "layout");
    }
  } catch {
    // Realtime + cache invalidation are best-effort.
  }
}

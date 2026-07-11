// ─── Forward-return assignment ("reviewers borrow, workers own") ─────────────
//
// Review stages (names matching "review"/"check") are pit stops: the reviewer
// borrows the task to approve or reject it, but the work still belongs to the
// person who produced it. When a task moves FORWARD out of a review stage and
// nothing else claims it (weekly-plan slot, target-stage Auto-Assign), it goes
// back to the last worker instead of sticking with the reviewer/mover.

import { isReviewStageName } from "@/lib/checklist-config";
import { normalizePermissions } from "@/lib/permissions";

export type StageRef = { id: string; name: string; order: number };

export type ReturnCandidateMember = {
  memberId: string;
  /** WorkspaceMember.type — owners bypass permission checks. */
  memberType: string;
  /** Raw stored role permissions JSON (null when the member has no role). */
  rolePermissions: unknown;
};

/**
 * Picks the worker a task should return to when it moves forward out of a
 * review stage. Returns null when no valid worker exists — the caller keeps
 * its usual fallback (the mover).
 *
 * Selection order:
 *   1. The recorded owner of the TARGET stage (the task has been there before,
 *      e.g. after a rejection loop) — mirrors how rollbacks restore owners.
 *   2. The owner of the highest non-review stage the task passed through
 *      before the review stage — the "last worker".
 *
 * Safety checks — the candidate must:
 *   • still be a member of the project (or be the workspace owner), and
 *   • be allowed to move the task forward from the TARGET stage (their role
 *     grants Forward there, or full Projects access).
 */
export function pickReturnWorker({
  history,
  statuses,
  fromStatusId,
  targetStatusId,
  projectMembers,
}: {
  /** Task.assignmentHistory — statusId → memberId of who owned that stage. */
  history: Record<string, string>;
  statuses: StageRef[];
  fromStatusId: string | null;
  targetStatusId: string;
  projectMembers: ReturnCandidateMember[];
}): string | null {
  const stageById = new Map(statuses.map((s) => [s.id, s]));
  const fromOrder = fromStatusId ? (stageById.get(fromStatusId)?.order ?? null) : null;

  const isEligible = (memberId: string | undefined): memberId is string => {
    if (!memberId) return false;
    const pm = projectMembers.find((m) => m.memberId === memberId);
    if (!pm) return false; // left the project — don't assign ghosts
    if (pm.memberType === "OWNER") return true;
    const perms = normalizePermissions(pm.rolePermissions);
    if (perms.projects === "full") return true;
    return perms.taskPermissions?.stages?.[targetStatusId]?.forward === true;
  };

  // 1. Returning to a stage someone already owned? Give it back to them.
  const targetStage = stageById.get(targetStatusId);
  if (targetStage && !isReviewStageName(targetStage.name)) {
    const previousOwner = history[targetStatusId];
    if (isEligible(previousOwner)) return previousOwner;
  }

  // 2. Otherwise: the owner of the most advanced non-review stage before the
  //    review stage the task is leaving.
  let best: { order: number; memberId: string } | null = null;
  for (const [stageId, memberId] of Object.entries(history)) {
    const stage = stageById.get(stageId);
    if (!stage) continue;
    if (isReviewStageName(stage.name)) continue;
    if (fromOrder != null && stage.order >= fromOrder) continue;
    if (best && stage.order <= best.order) continue;
    if (!isEligible(memberId)) continue;
    best = { order: stage.order, memberId };
  }
  return best?.memberId ?? null;
}

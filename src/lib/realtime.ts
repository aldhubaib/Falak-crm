import { EventEmitter } from "node:events";
import {
  publish as centrifugoPublish,
  projectChannel as centrifugoProjectChannel,
  isCentrifugoConfigured,
} from "@/lib/centrifugo";

// Weekly Plan slot bookkeeping carried on a move event, so boards can patch
// their slot placeholders in memory instead of refetching the whole board.
export type BoardWeeklyEmptySlot = {
  id: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
};

export type BoardWeeklyDelta = {
  templateId: string;
  /** A previously-empty slot was claimed by the moved task. */
  claimedSlotId?: string;
  /** A brand-new (bound) slot was created because this week wasn't materialised. */
  createdExtra?: boolean;
  /** The task rolled back out of Todo and freed this slot. */
  releasedSlot?: BoardWeeklyEmptySlot;
  /**
   * The move overflowed into (or rolled back out of) next week's plan cycle.
   * Too much changed for an in-memory patch — clients refetch the board.
   */
  overflow?: boolean;
};

export type BoardSlotPatch = {
  slotId: string;
  templateId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
};

// Changed card fields for a `task.moved` event, so subscribed boards can patch
// their cache in memory instead of refetching the whole board. With 100 open
// screens, one move used to trigger 100 full board queries; now it triggers 0.
export type BoardTaskMovePatch = {
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  stageEnteredAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  // Who moved the task into its new stage — the decline dialog @mentions them.
  submittedById: string | null;
  submittedByName: string | null;
  rejectionCountDelta: number;
  /** Weekly Plan slot change caused by this move, if any. */
  weekly?: BoardWeeklyDelta | null;
};

// Checklist progress for a task's board card, broadcast whenever a checklist
// item is completed/uncompleted (file upload finalized, text saved, attachment
// removed) so the drag gate on every open board unlocks without a refresh.
export type BoardChecklistPatch = {
  checklistTotal: number;
  checklistDone: number;
  deliveryIncomplete: string[];
};

// Event payload broadcast to every client subscribed to a project's board.
// `actorClientId` lets a client ignore the echo of its own optimistic action.
// `patch` (task.moved), `snapshot` (task.created) and `checklist`
// (task.updated) carry the data needed to update the board cache directly;
// clients fall back to a refetch when absent.
export type RealtimeEvent = {
  type:
    | "task.moved"
    | "task.created"
    | "task.deleted"
    | "task.updated"
    | "slot.updated"
    // Stage rules changed in Settings (role flags, checklist field rules) —
    // open boards refetch their data AND re-run the SSR render so the frozen
    // movePerms update without a manual reload.
    | "board.refresh";
  taskId?: string;
  actorClientId?: string | null;
  patch?: BoardTaskMovePatch;
  checklist?: BoardChecklistPatch;
  /** New owner after a self-assign — boards patch the card's avatar in place. */
  assignee?: { id: string; name: string; avatar: string | null } | null;
  /** Weekly plan slot reassigned via avatar click on a dashed placeholder. */
  slot?: BoardSlotPatch;
  // Full BoardTask snapshot (typed loosely to avoid importing action types here).
  snapshot?: Record<string, unknown>;
};

// Minimal transport interface. Centrifugo is the single production transport;
// `InProcessBus` remains only as the SSE fallback for local dev (single
// instance, no Centrifugo configured).
export interface RealtimeBus {
  publish(channel: string, event: RealtimeEvent): void;
  subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void;
}

class InProcessBus implements RealtimeBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Each open SSE connection registers a listener; allow many concurrent
    // subscribers without Node's default 10-listener leak warning.
    this.emitter.setMaxListeners(0);
  }

  publish(channel: string, event: RealtimeEvent): void {
    this.emitter.emit(channel, event);
  }

  subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }
}

// Persist the bus across dev HMR / module reloads so publishers and
// subscribers share the same instance.
const globalForBus = globalThis as unknown as { realtimeBus: RealtimeBus | undefined };

export const realtimeBus: RealtimeBus = globalForBus.realtimeBus ?? new InProcessBus();
globalForBus.realtimeBus = realtimeBus;

export function projectChannel(projectId: string): string {
  return `project:${projectId}`;
}

// Convenience publisher used by server actions after a successful write.
// Centrifugo is the single production transport. The in-process SSE bus is
// only fed when Centrifugo isn't configured (local dev) — publishing to both
// would double every event's fan-out for no benefit.
export function publishTaskEvent(
  projectId: string,
  event: RealtimeEvent,
): void {
  if (isCentrifugoConfigured()) {
    void centrifugoPublish(centrifugoProjectChannel(projectId), event);
    return;
  }
  try {
    realtimeBus.publish(projectChannel(projectId), event);
  } catch {
    // Realtime is best-effort; never let a broadcast failure break the write.
  }
}

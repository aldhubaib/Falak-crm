import { EventEmitter } from "node:events";
import Redis from "ioredis";
import {
  publish as centrifugoPublish,
  projectChannel as centrifugoProjectChannel,
} from "@/lib/centrifugo";

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
  type: "task.moved" | "task.created" | "task.deleted" | "task.updated";
  taskId: string;
  actorClientId?: string | null;
  patch?: BoardTaskMovePatch;
  checklist?: BoardChecklistPatch;
  // Full BoardTask snapshot (typed loosely to avoid importing action types here).
  snapshot?: Record<string, unknown>;
};

// Minimal transport interface. `RedisBus` (used when REDIS_URL is set) works
// across multiple app replicas; `InProcessBus` is the single-instance fallback
// for local development.
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

// Redis pub/sub bus so SSE events reach clients connected to any app replica.
// Uses two connections: one for PUBLISH (a subscriber connection cannot issue
// other commands) and one in subscriber mode. Local dispatch goes through an
// EventEmitter; Redis channels are SUBSCRIBEd on first local listener and
// UNSUBSCRIBEd when the last one disconnects.
class RedisBus implements RealtimeBus {
  private readonly emitter = new EventEmitter();
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly listenerCounts = new Map<string, number>();

  constructor(url: string) {
    this.emitter.setMaxListeners(0);
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    };
    this.pub = new Redis(url, options);
    this.sub = new Redis(url, options);
    // Realtime is best-effort: log connection problems, never throw.
    this.pub.on("error", (err) => console.error("[realtime] redis pub error:", err.message));
    this.sub.on("error", (err) => console.error("[realtime] redis sub error:", err.message));

    this.sub.on("message", (channel: string, raw: string) => {
      try {
        this.emitter.emit(channel, JSON.parse(raw) as RealtimeEvent);
      } catch {
        // Malformed payload — drop it.
      }
    });
  }

  publish(channel: string, event: RealtimeEvent): void {
    this.pub.publish(channel, JSON.stringify(event)).catch(() => {
      // Best-effort; a dropped broadcast must never break the write path.
    });
  }

  subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void {
    this.emitter.on(channel, listener);
    const count = (this.listenerCounts.get(channel) ?? 0) + 1;
    this.listenerCounts.set(channel, count);
    if (count === 1) {
      this.sub.subscribe(channel).catch(() => {});
    }

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.emitter.off(channel, listener);
      const remaining = (this.listenerCounts.get(channel) ?? 1) - 1;
      if (remaining <= 0) {
        this.listenerCounts.delete(channel);
        this.sub.unsubscribe(channel).catch(() => {});
      } else {
        this.listenerCounts.set(channel, remaining);
      }
    };
  }
}

function createBus(): RealtimeBus {
  const url = process.env.REDIS_URL;
  if (url) return new RedisBus(url);
  return new InProcessBus();
}

// Persist the bus across dev HMR / module reloads so publishers and subscribers
// share the same instance (and we don't leak Redis connections).
const globalForBus = globalThis as unknown as { realtimeBus: RealtimeBus | undefined };

export const realtimeBus: RealtimeBus = globalForBus.realtimeBus ?? createBus();
globalForBus.realtimeBus = realtimeBus;

export function projectChannel(projectId: string): string {
  return `project:${projectId}`;
}

// Convenience publisher used by server actions after a successful write.
// Publishes to both the SSE bus (Redis-backed in production) and to
// Centrifugo's project channel (the primary transport across replicas/clients).
export function publishTaskEvent(
  projectId: string,
  event: RealtimeEvent,
): void {
  try {
    realtimeBus.publish(projectChannel(projectId), event);
  } catch {
    // Realtime is best-effort; never let a broadcast failure break the write.
  }
  void centrifugoPublish(centrifugoProjectChannel(projectId), event);
}

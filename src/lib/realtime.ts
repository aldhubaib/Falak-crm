import { EventEmitter } from "node:events";
import {
  publish as centrifugoPublish,
  projectChannel as centrifugoProjectChannel,
} from "@/lib/centrifugo";

// Event payload broadcast to every client subscribed to a project's board.
// `actorClientId` lets a client ignore the echo of its own optimistic action.
export type RealtimeEvent = {
  type: "task.moved" | "task.created" | "task.deleted" | "task.updated";
  taskId: string;
  actorClientId?: string | null;
};

// Minimal transport interface. The in-process implementation below works on a
// single Railway instance. To scale horizontally (multiple replicas), swap this
// for a Redis pub/sub adapter implementing the same contract — no callers change.
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

// Persist the bus across dev HMR / module reloads so publishers and subscribers
// share the same instance.
const globalForBus = globalThis as unknown as { realtimeBus: RealtimeBus | undefined };

export const realtimeBus: RealtimeBus = globalForBus.realtimeBus ?? new InProcessBus();
globalForBus.realtimeBus = realtimeBus;

export function projectChannel(projectId: string): string {
  return `project:${projectId}`;
}

// Convenience publisher used by server actions after a successful write.
// Publishes to both the in-process SSE bus (single-instance fallback) and to
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

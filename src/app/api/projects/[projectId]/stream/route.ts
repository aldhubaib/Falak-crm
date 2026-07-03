import type { NextRequest } from "next/server";
import { getProjectAccess } from "@/lib/workspace";
import { realtimeBus, projectChannel, type RealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events stream for a project's board. Every connected client gets
// live task.moved / task.created / task.deleted events so all users see changes
// without polling or refreshing.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const access = await getProjectAccess(projectId);
  if (!access.hasAccess) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  const channel = projectChannel(projectId);

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller already closed — ignore.
        }
      };

      // Prime the connection so the client's `onopen` fires promptly.
      send(`retry: 3000\n\n`);
      send(`event: ready\ndata: {}\n\n`);

      const onEvent = (event: RealtimeEvent) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      };
      unsubscribe = realtimeBus.subscribe(channel, onEvent);

      // Heartbeat comment keeps proxies/load balancers from dropping an idle
      // connection.
      heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);

      const close = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", close);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

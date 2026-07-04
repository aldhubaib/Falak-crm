"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBoardData, type BoardData } from "@/actions/board";
import { useCentrifugo } from "@/components/realtime/centrifugo-provider";
import { projectChannel } from "@/lib/channels";

export function boardQueryKey(projectId: string) {
  return ["board", projectId] as const;
}

// Board task list, seeded from the server-rendered payload and kept live by the
// SSE stream. Uses React Query so optimistic mutations can patch the cache.
export function useBoardData(projectId: string, initialData: BoardData) {
  return useQuery({
    queryKey: boardQueryKey(projectId),
    queryFn: () => getBoardData(projectId),
    initialData,
  });
}

// Keeps the board live when another client changes something. Prefers Centrifugo
// (the primary transport); falls back to the in-process SSE stream when no
// Centrifugo WS URL is configured. The client's own echoes are ignored so they
// don't clobber an in-flight optimistic update.
export function useBoardStream(projectId: string, clientId: string) {
  const queryClient = useQueryClient();
  const cent = useCentrifugo();
  const enabled = cent?.enabled ?? false;

  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: boardQueryKey(projectId) });

    // Primary: Centrifugo project channel.
    if (enabled && cent) {
      return cent.subscribe(projectChannel(projectId), (data) => {
        const event = data as {
          type?: string;
          actorClientId?: string | null;
        } | null;
        if (!event?.type || !event.type.startsWith("task.")) return;
        if (event.actorClientId && event.actorClientId === clientId) return;
        invalidate();
      });
    }

    // Fallback: in-process SSE stream (single instance, no Centrifugo).
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }
    const source = new EventSource(`/api/projects/${projectId}/stream`);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { actorClientId?: string | null };
        if (event.actorClientId && event.actorClientId === clientId) return;
        invalidate();
      } catch {
        // Malformed frame — ignore.
      }
    };
    source.onerror = () => {};
    return () => source.close();
  }, [enabled, cent, projectId, clientId, queryClient]);
}
